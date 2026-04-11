import type { StructuralCopilotResponse } from "@/types/structural";
import type { PrivateReasoningService } from "@/server/reasoning/private-reasoning-service";
import type {
  TimberMemberBrowserAdapter,
  TimberMemberCapacityInput,
} from "@/server/tools/timber-member-browser-adapter";

export async function runTimberMemberWorkflow({
  request,
  timberTool,
  reasoningService,
}: {
  request: TimberMemberCapacityInput;
  timberTool: Pick<TimberMemberBrowserAdapter, "calculate">;
  reasoningService: PrivateReasoningService;
}): Promise<StructuralCopilotResponse> {
  const result = await timberTool.calculate(request);
  const reasoning = await reasoningService.summarize({
    workflowId: "timber_member_design",
    objective:
      "Summarize a timber member capacity assessment with key modifiers and pass/fail commentary.",
    allowedCapabilities: ["engineering_summary", "assumption_statement"],
  });

  return {
    workflowId: "timber_member_design",
    summary:
      reasoning.narrative ||
      `Timber member capacity assessment completed for ${request.timberGrade}.`,
    parsedInputs: [
      { label: "Timber grade", value: request.timberGrade },
      { label: "Structural category", value: request.structuralCategory },
      {
        label: "Load duration",
        value: request.loadDuration.replaceAll("_", " "),
      },
      { label: "Breadth", value: `${request.breadthMm} mm` },
      { label: "Depth", value: `${request.depthMm} mm` },
      { label: "Effective length", value: `${request.effectiveLengthMm} mm` },
      {
        label: "Effective length factor",
        value: request.effectiveLengthFactor.toFixed(2),
      },
      { label: "Load ratio", value: request.loadRatio.toFixed(2) },
      { label: "Moisture factor", value: request.moistureFactor.toFixed(2) },
      {
        label: "Temperature factor",
        value: request.temperatureFactor.toFixed(2),
      },
      { label: "Notch factor", value: request.notchFactor.toFixed(2) },
      { label: "Bending demand Mx", value: `${request.bendingMomentXKnM} kNm` },
      { label: "Bending demand My", value: `${request.bendingMomentYKnM} kNm` },
      {
        label: "Compression demand",
        value: `${request.compressionForceKn} kN`,
      },
      { label: "Tension demand", value: `${request.tensionForceKn} kN` },
      { label: "Shear demand", value: `${request.shearForceKn} kN` },
    ],
    assumptions: [
      "Timber capacity is evaluated using the live browser-backed timber tool.",
      `Structural category ${request.structuralCategory} and load duration ${request.loadDuration.replace("_", " ")} were applied.`,
      ...reasoning.assumptions,
    ],
    keyOutputs: [
      {
        label: "Bending capacity phiMx",
        value: result.bendingCapacityXKnM.toFixed(2),
        unit: "kNm",
      },
      {
        label: "Bending capacity phiMy",
        value: result.bendingCapacityYKnM.toFixed(2),
        unit: "kNm",
      },
      {
        label: "Shear capacity phiV",
        value: result.shearCapacityKn.toFixed(2),
        unit: "kN",
      },
      {
        label: "Compression capacity phiN",
        value: result.compressionCapacityKn.toFixed(2),
        unit: "kN",
      },
      {
        label: "Tension capacity phiNt",
        value: result.tensionCapacityKn.toFixed(2),
        unit: "kN",
      },
      { label: "Duration factor k1", value: result.durationFactor.toFixed(3) },
      { label: "Moisture factor k4", value: result.moistureFactor.toFixed(3) },
      {
        label: "Temperature factor k6",
        value: result.temperatureFactor.toFixed(3),
      },
      { label: "Notch factor k11", value: result.notchFactor.toFixed(3) },
      { label: "Bending unity ratio", value: result.unityBendingX.toFixed(3) },
      { label: "Shear unity ratio", value: result.unityShear.toFixed(3) },
      {
        label: "Beam stability factor k12",
        value: result.beamStabilityFactor.toFixed(3),
      },
    ],
    designOutputs: [
      {
        title: "Timber capacity tool",
        items: [
          { label: "Timber grade", value: request.timberGrade },
          {
            label: "Section size",
            value: `${request.breadthMm} x ${request.depthMm}`,
            unit: "mm",
          },
          {
            label: "Bending demand Mx",
            value: request.bendingMomentXKnM.toFixed(2),
            unit: "kNm",
          },
          {
            label: "Bending capacity phiMx",
            value: result.bendingCapacityXKnM.toFixed(2),
            unit: "kNm",
          },
          {
            label: "Bending demand My",
            value: request.bendingMomentYKnM.toFixed(2),
            unit: "kNm",
          },
          {
            label: "Bending capacity phiMy",
            value: result.bendingCapacityYKnM.toFixed(2),
            unit: "kNm",
          },
          {
            label: "Compression demand",
            value: request.compressionForceKn.toFixed(2),
            unit: "kN",
          },
          {
            label: "Compression capacity phiN",
            value: result.compressionCapacityKn.toFixed(2),
            unit: "kN",
          },
          {
            label: "Tension demand",
            value: request.tensionForceKn.toFixed(2),
            unit: "kN",
          },
          {
            label: "Tension capacity phiNt",
            value: result.tensionCapacityKn.toFixed(2),
            unit: "kN",
          },
          {
            label: "Shear demand",
            value: request.shearForceKn.toFixed(2),
            unit: "kN",
          },
          {
            label: "Shear capacity phiV",
            value: result.shearCapacityKn.toFixed(2),
            unit: "kN",
          },
        ],
      },
      {
        title: "Timber modifiers",
        items: [
          { label: "Load duration factor k1", value: result.durationFactor.toFixed(3) },
          { label: "Moisture factor k4", value: result.moistureFactor.toFixed(3) },
          {
            label: "Temperature factor k6",
            value: result.temperatureFactor.toFixed(3),
          },
          { label: "Notch factor k11", value: result.notchFactor.toFixed(3) },
          {
            label: "Beam stability factor k12",
            value: result.beamStabilityFactor.toFixed(3),
          },
          { label: "Bending unity ratio", value: result.unityBendingX.toFixed(3) },
          { label: "Shear unity ratio", value: result.unityShear.toFixed(3) },
        ],
      },
    ],
    comparisonTables: [],
    recommendedOption: `Use ${request.timberGrade} with a ${request.breadthMm} x ${request.depthMm} mm section only if final detailing and code checks confirm the reported unity ratios remain acceptable.`,
    alternatives: [],
    commentary: [
      `Bending capacity check: ${result.bendingCapacityXKnM.toFixed(2)} kNm against ${request.bendingMomentXKnM.toFixed(2)} kNm demand.`,
      `Minor-axis bending capacity reported by the tool is ${result.bendingCapacityYKnM.toFixed(2)} kNm against ${request.bendingMomentYKnM.toFixed(2)} kNm demand.`,
      `Shear capacity check: ${result.shearCapacityKn.toFixed(2)} kN against ${request.shearForceKn.toFixed(2)} kN demand.`,
      `Axial capacities reported by the tool are ${result.compressionCapacityKn.toFixed(2)} kN in compression and ${result.tensionCapacityKn.toFixed(2)} kN in tension.`,
      `Modifier factors used by the tool include k1=${result.durationFactor.toFixed(3)}, k4=${result.moistureFactor.toFixed(2)}, k6=${result.temperatureFactor.toFixed(2)}, and k11=${result.notchFactor.toFixed(2)}.`,
    ],
    warnings: [
      "This timber workflow is preliminary and depends on browser automation against the approved external tool.",
      "Connection details, restraint assumptions, and project-specific detailing should still be checked by an engineer.",
    ],
    engineerReviewDisclaimer:
      "Engineer review required before any design, documentation, procurement, or construction use.",
    visualisations: {
      title: "Timber utilization summary",
      items: [
        {
          x: "Bending",
          y: result.unityBendingX,
          label: result.unityBendingX <= 1 ? "Pass" : "Fail",
        },
        {
          x: "Shear",
          y: result.unityShear,
          label: result.unityShear <= 1 ? "Pass" : "Fail",
        },
      ],
    },
  };
}
