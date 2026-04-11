import type { StructuralCopilotResponse } from "@/types/structural";
import type { PrivateReasoningService } from "@/server/reasoning/private-reasoning-service";
import type { StructuralToolAdapters } from "@/server/tools/tool-adapters";
import type { NormalizedRcBeamRequest } from "@/server/domain/input-extraction";

interface CandidateResult {
  widthMm: number;
  depthMm: number;
  reinforcementAreaMm2: number;
  rebarDiameterMm: number;
  rebarCount: number;
  stirrupDiameterMm: number;
  stirrupLegCount: number;
  stirrupSpacingMm: number;
  momentCapacityKnM: number;
  shearCapacityKn: number;
  momentUtilization: number;
  shearUtilization: number;
}

interface CandidatePrototype {
  widthMm: number;
  depthMm: number;
  rebarDiameterMm: number;
  rebarCount: number;
  stirrupDiameterMm: number;
  stirrupLegCount: number;
  stirrupSpacingMm: number;
}

const defaultCandidateSections: CandidatePrototype[] = [
  {
    widthMm: 250,
    depthMm: 450,
    rebarDiameterMm: 16,
    rebarCount: 4,
    stirrupDiameterMm: 10,
    stirrupLegCount: 2,
    stirrupSpacingMm: 200,
  },
  {
    widthMm: 300,
    depthMm: 500,
    rebarDiameterMm: 20,
    rebarCount: 4,
    stirrupDiameterMm: 10,
    stirrupLegCount: 2,
    stirrupSpacingMm: 200,
  },
  {
    widthMm: 300,
    depthMm: 600,
    rebarDiameterMm: 24,
    rebarCount: 4,
    stirrupDiameterMm: 12,
    stirrupLegCount: 2,
    stirrupSpacingMm: 180,
  },
  {
    widthMm: 350,
    depthMm: 650,
    rebarDiameterMm: 24,
    rebarCount: 5,
    stirrupDiameterMm: 12,
    stirrupLegCount: 2,
    stirrupSpacingMm: 150,
  },
];

export async function runRcBeamWorkflow({
  request,
  tools,
  reasoningService,
}: {
  request: Required<
    Pick<
      NormalizedRcBeamRequest,
      "spanMeters" | "appliedLoadKnPerM" | "supportCondition" | "materialFamily"
    >
  > &
    Pick<
      NormalizedRcBeamRequest,
      | "requiresMomentCheck"
      | "requiresShearCheck"
      | "requiresSteelAlternative"
      | "concreteStrengthMpa"
      | "steelYieldStrengthMpa"
      | "requestedCoverMm"
      | "requestedWidthMm"
      | "requestedDepthMm"
      | "requestedRebarCount"
      | "requestedRebarDiameterMm"
      | "requestedRebarLayerCount"
      | "requestedStirrupDiameterMm"
      | "requestedStirrupLegCount"
      | "requestedStirrupSpacingMm"
    >;
  tools: StructuralToolAdapters;
  reasoningService: PrivateReasoningService;
}): Promise<StructuralCopilotResponse> {
  const concreteStrengthMpa = request.concreteStrengthMpa ?? 32;
  const steelYieldStrengthMpa = request.steelYieldStrengthMpa ?? 500;
  const coverMm = request.requestedCoverMm ?? 45;
  const candidateSections = buildCandidateSections(request);
  const parsedInputs = buildParsedInputs(request, concreteStrengthMpa, steelYieldStrengthMpa);

  const designActions = await tools.designActions({
    spanMeters: request.spanMeters,
    supportCondition: request.supportCondition,
    appliedLoadKnPerM: request.appliedLoadKnPerM,
  });

  const candidateResults = await Promise.all(
    candidateSections.map(async (candidate) => {
      const effectiveDepthMm = candidate.depthMm - coverMm;
      const reinforcementAreaMm2 =
        candidate.rebarCount *
        Math.PI *
        Math.pow(candidate.rebarDiameterMm / 2, 2);
      const stirrupAreaMm2 =
        candidate.stirrupLegCount *
        Math.PI *
        Math.pow(candidate.stirrupDiameterMm / 2, 2);
      const [momentCapacity, shearCapacity] = await Promise.all([
        tools.rcMomentCapacity({
          widthMm: candidate.widthMm,
          depthMm: candidate.depthMm,
          reinforcementAreaMm2,
          concreteStrengthMpa,
          steelYieldStrengthMpa,
          coverMm,
          rebarDiameterMm: candidate.rebarDiameterMm,
          rebarCount: candidate.rebarCount,
        }),
        tools.rcShearCapacity({
          appliedShearKn: designActions.ultimateShearKn,
          appliedMomentKnM: designActions.ultimateMomentKnM,
          axialForceKn: 0,
          widthMm: candidate.widthMm,
          effectiveDepthMm,
          aggregateSizeMm: 20,
          concreteStrengthMpa,
          longitudinalSteelAreaMm2: reinforcementAreaMm2,
          prestressingSteelAreaMm2: 0,
          stirrupAreaMm2,
          stirrupSpacingMm: candidate.stirrupSpacingMm,
          steelYieldStrengthMpa,
          prestressVerticalComponentKn: 0,
          prestressStressMpa: 0,
          prestressFactor: 1,
          elasticModulusSteelMpa: 200000,
          elasticModulusPrestressMpa: 195000,
          strutAngleDegrees: 45,
        }),
      ]);

      return {
        ...candidate,
        reinforcementAreaMm2,
        momentCapacityKnM: momentCapacity.capacityKnM,
        shearCapacityKn: shearCapacity.capacityKn,
        momentUtilization: designActions.ultimateMomentKnM / momentCapacity.capacityKnM,
        shearUtilization: designActions.ultimateShearKn / shearCapacity.capacityKn,
      } satisfies CandidateResult;
    }),
  );

  const feasibleCandidates = candidateResults
    .filter((candidate) => candidate.momentUtilization <= 1 && candidate.shearUtilization <= 1)
    .sort(
      (left, right) =>
        left.depthMm * left.widthMm - right.depthMm * right.widthMm ||
        left.momentUtilization - right.momentUtilization,
    );

  const selectedCandidate = feasibleCandidates[0] ?? candidateResults.at(-1);

  if (!selectedCandidate) {
    throw new Error("No RC beam candidates were generated.");
  }

  const steelAlternatives = request.requiresSteelAlternative
    ? await tools.steelSectionSearch({
        requiredMomentKnM: designActions.ultimateMomentKnM,
        spanMeters: request.spanMeters,
      })
    : [];

  const reasoning = await reasoningService.summarize({
    workflowId: "rc_beam_design",
    objective:
      "Summarize a preliminary RC beam sizing result with assumptions and conservative commentary.",
    allowedCapabilities: ["engineering_summary", "assumption_statement"],
  });

  const selectedArea = selectedCandidate.widthMm * selectedCandidate.depthMm;

  return {
    workflowId: "rc_beam_design",
    summary:
      reasoning.narrative ||
      `Preliminary RC beam sizing completed for a ${request.spanMeters} m span under ${request.appliedLoadKnPerM} kN/m.`,
    parsedInputs,
    assumptions: [
      "MVP sizing logic still uses a simplified preliminary shear model even when browser-backed tools are enabled.",
      `Concrete strength taken as ${concreteStrengthMpa} MPa and steel yield strength taken as ${steelYieldStrengthMpa} MPa from the prompt or workflow defaults.`,
      `Concrete cover taken as ${coverMm} mm from the prompt or workflow default.`,
      request.requestedWidthMm || request.requestedDepthMm
        ? `User-requested section dimensions were locked into candidate evaluation${request.requestedWidthMm && request.requestedDepthMm ? ` at ${request.requestedWidthMm} x ${request.requestedDepthMm} mm` : ""}.`
        : "Section sizing is selected from the internal candidate set unless the prompt specifies dimensions.",
      request.requestedRebarCount && request.requestedRebarDiameterMm
        ? `User-requested main reinforcement ${request.requestedRebarCount}N${request.requestedRebarDiameterMm}${request.requestedRebarLayerCount ? ` in ${request.requestedRebarLayerCount} layers` : ""} was locked into candidate evaluation.`
        : "Main reinforcement is selected from the internal candidate set unless the prompt specifies a bar arrangement.",
      request.requestedStirrupDiameterMm
        ? `User-requested ligatures were interpreted as ${request.requestedStirrupLegCount ?? 2}-leg N${request.requestedStirrupDiameterMm}${request.requestedStirrupSpacingMm ? ` @ ${request.requestedStirrupSpacingMm} mm` : " with default spacing from the nearest candidate"} and locked into shear evaluation.`
        : "Ligatures are selected from the internal candidate set unless the prompt specifies a stirrup arrangement.",
      "Effective depth is approximated as overall depth minus 50 mm for candidate ranking.",
      "Loads are treated as uniformly distributed line loads for the selected support condition.",
      ...reasoning.assumptions,
    ],
    keyOutputs: [
      {
        label: "Ultimate design moment",
        value: designActions.ultimateMomentKnM.toFixed(2),
        unit: "kN.m",
      },
      {
        label: "Ultimate design shear",
        value: designActions.ultimateShearKn.toFixed(2),
        unit: "kN",
      },
      {
        label: "Recommended section",
        value: `${selectedCandidate.widthMm} x ${selectedCandidate.depthMm}`,
        unit: "mm",
      },
      {
        label: "Recommended reinforcement",
        value: `${selectedCandidate.rebarCount}N${selectedCandidate.rebarDiameterMm}`,
      },
      {
        label: "Assumed ligatures",
        value: `${selectedCandidate.stirrupLegCount}-leg N${selectedCandidate.stirrupDiameterMm} @ ${selectedCandidate.stirrupSpacingMm} mm`,
      },
      {
        label: "Concrete strength",
        value: concreteStrengthMpa.toFixed(0),
        unit: "MPa",
      },
      {
        label: "Concrete cover",
        value: coverMm.toFixed(0),
        unit: "mm",
      },
      {
        label: "Moment utilization",
        value: selectedCandidate.momentUtilization.toFixed(3),
      },
      {
        label: "Shear utilization",
        value: selectedCandidate.shearUtilization.toFixed(3),
      },
      {
        label: "Moment capacity",
        value: selectedCandidate.momentCapacityKnM.toFixed(2),
        unit: "kN.m",
      },
      {
        label: "Shear capacity",
        value: selectedCandidate.shearCapacityKn.toFixed(2),
        unit: "kN",
      },
    ],
    designOutputs: [
      {
        title: "Selected RC design",
        items: [
          {
            label: "Section size",
            value: `${selectedCandidate.widthMm} x ${selectedCandidate.depthMm}`,
            unit: "mm",
          },
          {
            label: "Concrete strength",
            value: concreteStrengthMpa.toFixed(0),
            unit: "MPa",
          },
          {
            label: "Steel yield strength",
            value: steelYieldStrengthMpa.toFixed(0),
            unit: "MPa",
          },
          {
            label: "Concrete cover",
            value: coverMm.toFixed(0),
            unit: "mm",
          },
          {
            label: "Main reinforcement",
            value: `${selectedCandidate.rebarCount}N${selectedCandidate.rebarDiameterMm}`,
          },
          {
            label: "Main steel area As",
            value: selectedCandidate.reinforcementAreaMm2.toFixed(0),
            unit: "mm^2",
          },
          {
            label: "Ligatures",
            value: `${selectedCandidate.stirrupLegCount}-leg N${selectedCandidate.stirrupDiameterMm} @ ${selectedCandidate.stirrupSpacingMm} mm`,
          },
          {
            label: "Ligature steel area Av",
            value: (
              selectedCandidate.stirrupLegCount *
              Math.PI *
              Math.pow(selectedCandidate.stirrupDiameterMm / 2, 2)
            ).toFixed(0),
            unit: "mm^2",
          },
          {
            label: "Effective depth used",
            value: (selectedCandidate.depthMm - coverMm).toFixed(0),
            unit: "mm",
          },
        ],
      },
      {
        title: "Design actions",
        items: [
          {
            label: "Ultimate design moment",
            value: designActions.ultimateMomentKnM.toFixed(2),
            unit: "kN.m",
          },
          {
            label: "Ultimate design shear",
            value: designActions.ultimateShearKn.toFixed(2),
            unit: "kN",
          },
        ],
      },
      {
        title: "Moment verification",
        items: [
          {
            label: "Moment demand Mu",
            value: designActions.ultimateMomentKnM.toFixed(2),
            unit: "kN.m",
          },
          {
            label: "Moment capacity phiMn",
            value: selectedCandidate.momentCapacityKnM.toFixed(2),
            unit: "kN.m",
          },
          {
            label: "Demand / capacity ratio",
            value: selectedCandidate.momentUtilization.toFixed(3),
          },
          {
            label: "Moment check status",
            value: selectedCandidate.momentUtilization <= 1 ? "Pass" : "Check",
          },
        ],
      },
      {
        title: "Shear verification",
        items: [
          {
            label: "Shear demand Vu",
            value: designActions.ultimateShearKn.toFixed(2),
            unit: "kN",
          },
          {
            label: "Shear capacity phiVu",
            value: selectedCandidate.shearCapacityKn.toFixed(2),
            unit: "kN",
          },
          {
            label: "Demand / capacity ratio",
            value: selectedCandidate.shearUtilization.toFixed(3),
          },
          {
            label: "Shear check status",
            value: selectedCandidate.shearUtilization <= 1 ? "Pass" : "Check",
          },
        ],
      },
      {
        title: "RC candidate comparison",
        items: candidateResults
          .sort(
            (left, right) =>
              left.widthMm * left.depthMm - right.widthMm * right.depthMm,
          )
          .map((candidate) => ({
            label: `${candidate.widthMm} x ${candidate.depthMm} mm with ${candidate.rebarCount}N${candidate.rebarDiameterMm}`,
            value: `Mu ratio ${candidate.momentUtilization.toFixed(3)}, Vu ratio ${candidate.shearUtilization.toFixed(3)}${candidate.widthMm === selectedCandidate.widthMm && candidate.depthMm === selectedCandidate.depthMm ? " (selected)" : ""}`,
          })),
      },
      ...(steelAlternatives.length
        ? [
            {
              title: "Steel alternative search",
              items: steelAlternatives.map((option) => ({
                label: option.designation,
                value: option.utilizationRatio.toFixed(2),
                unit: "utilization",
              })),
            },
          ]
        : []),
    ],
    comparisonTables: [
      {
        title: "RC candidate comparison",
        columns: [
          { key: "section", label: "Section" },
          { key: "reinforcement", label: "Main bars" },
          { key: "ligatures", label: "Ligatures" },
          { key: "momentCapacity", label: "phiMn", align: "right" },
          { key: "momentRatio", label: "Mu / phiMn", align: "right" },
          { key: "shearCapacity", label: "phiVu", align: "right" },
          { key: "shearRatio", label: "Vu / phiVu", align: "right" },
          { key: "status", label: "Status", align: "center" },
        ],
        rows: candidateResults
          .slice()
          .sort(
            (left, right) =>
              left.widthMm * left.depthMm - right.widthMm * right.depthMm,
          )
          .map((candidate, index) => {
            const isSelected =
              candidate.widthMm === selectedCandidate.widthMm &&
              candidate.depthMm === selectedCandidate.depthMm &&
              candidate.rebarCount === selectedCandidate.rebarCount &&
              candidate.rebarDiameterMm === selectedCandidate.rebarDiameterMm &&
              candidate.stirrupDiameterMm === selectedCandidate.stirrupDiameterMm &&
              candidate.stirrupSpacingMm === selectedCandidate.stirrupSpacingMm;
            const isFeasible =
              candidate.momentUtilization <= 1 &&
              candidate.shearUtilization <= 1;

            return {
              id: `candidate-${index + 1}`,
              status: isSelected
                ? "selected"
                : isFeasible
                  ? "feasible"
                  : "governing",
              values: {
                section: `${candidate.widthMm} x ${candidate.depthMm} mm`,
                reinforcement: `${candidate.rebarCount}N${candidate.rebarDiameterMm}`,
                ligatures: `${candidate.stirrupLegCount}-leg N${candidate.stirrupDiameterMm} @ ${candidate.stirrupSpacingMm}`,
                momentCapacity: `${candidate.momentCapacityKnM.toFixed(2)} kN.m`,
                momentRatio: candidate.momentUtilization.toFixed(3),
                shearCapacity: `${candidate.shearCapacityKn.toFixed(2)} kN`,
                shearRatio: candidate.shearUtilization.toFixed(3),
                status: isSelected
                  ? "Selected"
                  : isFeasible
                    ? "Feasible"
                    : "Revise",
              },
            };
          }),
      },
    ],
    recommendedOption: `Use a preliminary RC beam section of ${selectedCandidate.widthMm} x ${selectedCandidate.depthMm} mm with ${selectedCandidate.rebarCount}N${selectedCandidate.rebarDiameterMm} tensile reinforcement (${selectedCandidate.reinforcementAreaMm2.toFixed(0)} mm^2).`,
    alternatives: steelAlternatives.map(
      (option) =>
        `${option.designation} with utilization ratio ${option.utilizationRatio.toFixed(2)}`,
    ),
    commentary: [
      `Selected candidate footprint is ${selectedArea.toFixed(0)} mm^2 and is the smallest feasible option in the current candidate set.`,
      `Moment lever arm assumptions include an effective depth based on ${coverMm} mm concrete cover.`,
      `Moment capacity check: ${selectedCandidate.momentCapacityKnM.toFixed(2)} kN.m available against ${designActions.ultimateMomentKnM.toFixed(2)} kN.m demand.`,
      `Shear capacity check: ${selectedCandidate.shearCapacityKn.toFixed(2)} kN available against ${designActions.ultimateShearKn.toFixed(2)} kN demand using assumed ${selectedCandidate.stirrupLegCount}-leg N${selectedCandidate.stirrupDiameterMm} ligatures at ${selectedCandidate.stirrupSpacingMm} mm.`,
    ],
    warnings: [
      "This output is for preliminary sizing only and must be reviewed by a qualified structural engineer.",
      "Detailed code compliance, serviceability, anchorage, crack control, and constructability checks are not yet included in the MVP workflow.",
    ],
    engineerReviewDisclaimer:
      "Engineer review required before any design, documentation, procurement, or construction use.",
    visualisations: {
      title: "RC beam candidate section area by option",
      items: candidateResults.map((candidate) => ({
        x: `${candidate.widthMm}x${candidate.depthMm}`,
        y: candidate.widthMm * candidate.depthMm,
        label:
          candidate.widthMm === selectedCandidate.widthMm &&
          candidate.depthMm === selectedCandidate.depthMm
            ? "Recommended"
            : undefined,
      })),
    },
  };
}

function buildCandidateSections(
  request: Pick<
    NormalizedRcBeamRequest,
    | "requestedRebarCount"
    | "requestedRebarDiameterMm"
    | "requestedWidthMm"
    | "requestedDepthMm"
    | "requestedStirrupDiameterMm"
    | "requestedStirrupLegCount"
    | "requestedStirrupSpacingMm"
  >,
): CandidatePrototype[] {
  const baseCandidates =
    request.requestedWidthMm || request.requestedDepthMm
      ? [
          {
            ...defaultCandidateSections[0],
            widthMm: request.requestedWidthMm ?? defaultCandidateSections[0].widthMm,
            depthMm: request.requestedDepthMm ?? defaultCandidateSections[0].depthMm,
          },
        ]
      : defaultCandidateSections;

  return baseCandidates.map((candidate) => ({
    ...candidate,
    rebarCount: request.requestedRebarCount ?? candidate.rebarCount,
    rebarDiameterMm:
      request.requestedRebarDiameterMm ?? candidate.rebarDiameterMm,
    stirrupDiameterMm:
      request.requestedStirrupDiameterMm ?? candidate.stirrupDiameterMm,
    stirrupLegCount:
      request.requestedStirrupLegCount ?? candidate.stirrupLegCount,
    stirrupSpacingMm:
      request.requestedStirrupSpacingMm ?? candidate.stirrupSpacingMm,
  }));
}

function buildParsedInputs(
  request: Pick<
    NormalizedRcBeamRequest,
    | "spanMeters"
    | "supportCondition"
    | "appliedLoadKnPerM"
    | "requestedCoverMm"
    | "requestedWidthMm"
    | "requestedDepthMm"
    | "requestedRebarCount"
    | "requestedRebarDiameterMm"
    | "requestedRebarLayerCount"
    | "requestedStirrupDiameterMm"
    | "requestedStirrupLegCount"
    | "requestedStirrupSpacingMm"
  >,
  concreteStrengthMpa: number,
  steelYieldStrengthMpa: number,
) {
  const items = [
    { label: "Span", value: `${request.spanMeters} m` },
    { label: "Support condition", value: request.supportCondition ?? "Not parsed" },
    { label: "Applied load", value: `${request.appliedLoadKnPerM} kN/m` },
    { label: "Concrete strength", value: `${concreteStrengthMpa} MPa` },
    { label: "Steel yield strength", value: `${steelYieldStrengthMpa} MPa` },
  ];

  if (request.requestedWidthMm || request.requestedDepthMm) {
    items.push({
      label: "Requested section size",
      value: `${request.requestedWidthMm ?? "?"} x ${request.requestedDepthMm ?? "?"} mm`,
    });
  }

  if (request.requestedRebarCount && request.requestedRebarDiameterMm) {
    items.push({
      label: "Requested main reinforcement",
      value: `${request.requestedRebarCount}N${request.requestedRebarDiameterMm}${request.requestedRebarLayerCount ? ` in ${request.requestedRebarLayerCount} layers` : ""}`,
    });
  }

  if (request.requestedCoverMm) {
    items.push({
      label: "Requested concrete cover",
      value: `${request.requestedCoverMm} mm`,
    });
  }

  if (request.requestedStirrupDiameterMm) {
    items.push({
      label: "Requested ligatures",
      value: `${request.requestedStirrupLegCount ?? 2}-leg N${request.requestedStirrupDiameterMm}${request.requestedStirrupSpacingMm ? ` @ ${request.requestedStirrupSpacingMm} mm` : ""}`,
    });
  }

  return items;
}
