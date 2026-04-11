import type { StructuralCopilotResponse } from "@/types/structural";
import type { PrivateReasoningService } from "@/server/reasoning/private-reasoning-service";
import type {
  AdvancedSectionPropertyBrowserAdapter,
  AdvancedSectionPropertyInput,
} from "@/server/tools/advanced-section-property-browser-adapter";

export async function runSectionPropertyWorkflow({
  request,
  sectionTool,
  reasoningService,
}: {
  request: AdvancedSectionPropertyInput;
  sectionTool: Pick<AdvancedSectionPropertyBrowserAdapter, "calculate">;
  reasoningService: PrivateReasoningService;
}): Promise<StructuralCopilotResponse> {
  const result = await sectionTool.calculate(request);
  const reasoning = await reasoningService.summarize({
    workflowId: "section_property_analysis",
    objective:
      "Summarize a section property calculation with key geometric outputs for a supported cross-section shape.",
    allowedCapabilities: ["engineering_summary", "assumption_statement"],
  });

  return {
    workflowId: "section_property_analysis",
    summary:
      reasoning.narrative ||
      `Section property analysis completed for a ${formatShapeType(request.shapeType)}.`,
    parsedInputs: buildParsedInputs(request),
    assumptions: [
      "Section properties are calculated using the live browser-backed advanced section property tool.",
      "Only approved shape families are supported in this workflow.",
      ...reasoning.assumptions,
    ],
    keyOutputs: [
      { label: "Area", value: formatScientific(result.areaMm2), unit: "mm^2" },
      {
        label: "Centroid X",
        value: result.centroidXMm.toFixed(2),
        unit: "mm",
      },
      {
        label: "Centroid Y",
        value: result.centroidYMm.toFixed(2),
        unit: "mm",
      },
      {
        label: "Second moment Ixx",
        value: formatScientific(result.ixxMm4),
        unit: "mm^4",
      },
      {
        label: "Second moment Iyy",
        value: formatScientific(result.iyyMm4),
        unit: "mm^4",
      },
      {
        label: "Polar moment J",
        value: formatScientific(result.polarMomentMm4),
        unit: "mm^4",
      },
      {
        label: "Principal moment I1",
        value: formatScientific(result.principalI1Mm4),
        unit: "mm^4",
      },
      {
        label: "Principal moment I2",
        value: formatScientific(result.principalI2Mm4),
        unit: "mm^4",
      },
    ],
    designOutputs: [
      {
        title: "Primary section properties",
        items: [
          {
            label: "Cross-sectional area",
            value: formatScientific(result.areaMm2),
            unit: "mm^2",
          },
          {
            label: "Centroid X-coordinate",
            value: result.centroidXMm.toFixed(2),
            unit: "mm",
          },
          {
            label: "Centroid Y-coordinate",
            value: result.centroidYMm.toFixed(2),
            unit: "mm",
          },
          {
            label: "y-position",
            value: result.yPositionMm.toFixed(2),
            unit: "mm",
          },
          {
            label: "Second moment Ixx",
            value: formatScientific(result.ixxMm4),
            unit: "mm^4",
          },
          {
            label: "Second moment Iyy",
            value: formatScientific(result.iyyMm4),
            unit: "mm^4",
          },
          {
            label: "Product of inertia Ixy",
            value: formatScientific(result.ixyMm4),
            unit: "mm^4",
          },
        ],
      },
      {
        title: "Derived section properties",
        items: [
          {
            label: "Polar moment J",
            value: formatScientific(result.polarMomentMm4),
            unit: "mm^4",
          },
          {
            label: "Principal moment I1",
            value: formatScientific(result.principalI1Mm4),
            unit: "mm^4",
          },
          {
            label: "Principal moment I2",
            value: formatScientific(result.principalI2Mm4),
            unit: "mm^4",
          },
        ],
      },
    ],
    comparisonTables: [],
    recommendedOption:
      "Use these normalized section properties as backend inputs for approved downstream structural checks, not as a standalone final design decision.",
    alternatives: [],
    commentary: [
      `The computed area is ${formatScientific(result.areaMm2)} mm^2 with centroid located at x=${result.centroidXMm.toFixed(2)} mm and y=${result.centroidYMm.toFixed(2)} mm.`,
      `Flexural stiffness indicators are Ixx=${formatScientific(result.ixxMm4)} mm^4 and Iyy=${formatScientific(result.iyyMm4)} mm^4.`,
      `The tool also reported polar moment J=${formatScientific(result.polarMomentMm4)} mm^4 and principal moments I1=${formatScientific(result.principalI1Mm4)} mm^4, I2=${formatScientific(result.principalI2Mm4)} mm^4.`,
    ],
    warnings: [
      "This workflow is geometry-based only and does not perform material strength or code-compliance checks.",
      "Custom geometry and image-extracted shapes are not yet exposed through this copilot workflow.",
    ],
    engineerReviewDisclaimer:
      "Engineer review required before using these section properties in design, documentation, procurement, or construction decisions.",
    visualisations: {
      title: "Section property comparison",
      items: [
        { x: "Ixx", y: normalizeForChart(result.ixxMm4), label: "Ixx" },
        { x: "Iyy", y: normalizeForChart(result.iyyMm4), label: "Iyy" },
        { x: "J", y: normalizeForChart(result.polarMomentMm4), label: "J" },
      ],
    },
  };
}

function buildParsedInputs(request: AdvancedSectionPropertyInput) {
  if (request.shapeType === "rectangular") {
    return [
      { label: "Shape type", value: "Rectangular section" },
      { label: "Width", value: `${request.widthMm} mm` },
      { label: "Height", value: `${request.heightMm} mm` },
    ];
  }

  if (request.shapeType === "circular") {
    return [
      { label: "Shape type", value: "Circular section" },
      { label: "Radius", value: `${request.radiusMm} mm` },
      { label: "Diameter", value: `${((request.radiusMm ?? 0) * 2).toFixed(0)} mm` },
    ];
  }

  return [
    { label: "Shape type", value: "I-section" },
    { label: "Flange width", value: `${request.flangeWidthMm} mm` },
    { label: "Flange thickness", value: `${request.flangeThicknessMm} mm` },
    { label: "Web height", value: `${request.webHeightMm} mm` },
    { label: "Web thickness", value: `${request.webThicknessMm} mm` },
  ];
}

function formatShapeType(shapeType: AdvancedSectionPropertyInput["shapeType"]): string {
  return shapeType === "i_section" ? "I-section" : `${shapeType} section`;
}

function formatScientific(value: number): string {
  return value.toExponential(3);
}

function normalizeForChart(value: number): number {
  return Number(value.toExponential(3));
}
