import type { CopilotQuestionPayload } from "@/types/structural";
import type {
  AdvancedSectionPropertyInput,
  AdvancedSectionShape,
} from "@/server/tools/advanced-section-property-browser-adapter";

export interface NormalizedSectionPropertyRequest
  extends AdvancedSectionPropertyInput {
  shapeType: AdvancedSectionShape;
}

export function extractSectionPropertyRequest(
  payload: CopilotQuestionPayload,
): Partial<NormalizedSectionPropertyRequest> {
  const prompt = payload.prompt;
  const shapeType = extractShapeType(prompt);

  if (!shapeType) {
    return {};
  }

  if (shapeType === "rectangular") {
    return {
      shapeType,
      widthMm:
        extractNumber(prompt, /(?:width|breadth)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i) ??
        extractSectionDimension(prompt, 1),
      heightMm:
        extractNumber(prompt, /(?:height|depth)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i) ??
        extractSectionDimension(prompt, 2),
    };
  }

  if (shapeType === "circular") {
    const radiusMm =
      extractNumber(prompt, /(?:radius)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i) ??
      extractDiameter(prompt);

    return {
      shapeType,
      radiusMm,
    };
  }

  return {
    shapeType,
    flangeWidthMm: extractNumber(
      prompt,
      /(?:flange width|bf)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i,
    ),
    flangeThicknessMm: extractNumber(
      prompt,
      /(?:flange thickness|tf)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i,
    ),
    webHeightMm: extractNumber(
      prompt,
      /(?:web height|hw)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i,
    ),
    webThicknessMm: extractNumber(
      prompt,
      /(?:web thickness|tw)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i,
    ),
  };
}

export function findMissingSectionPropertyInputs(
  request: Partial<NormalizedSectionPropertyRequest>,
): string[] {
  if (!request.shapeType) {
    return ["shapeType"];
  }

  if (request.shapeType === "rectangular") {
    return [
      ...(request.widthMm === undefined ? ["widthMm"] : []),
      ...(request.heightMm === undefined ? ["heightMm"] : []),
    ];
  }

  if (request.shapeType === "circular") {
    return request.radiusMm === undefined ? ["radiusMm"] : [];
  }

  return [
    ...(request.flangeWidthMm === undefined ? ["flangeWidthMm"] : []),
    ...(request.flangeThicknessMm === undefined ? ["flangeThicknessMm"] : []),
    ...(request.webHeightMm === undefined ? ["webHeightMm"] : []),
    ...(request.webThicknessMm === undefined ? ["webThicknessMm"] : []),
  ];
}

function extractShapeType(prompt: string): AdvancedSectionShape | undefined {
  if (/i-section|i section|i-beam/i.test(prompt)) {
    return "i_section";
  }

  if (/circular|circle|diameter|radius/i.test(prompt)) {
    return "circular";
  }

  if (/rectangular|rectangle|\d+(?:\.\d+)?\s*[xX]\s*\d+(?:\.\d+)?\s*mm/i.test(prompt)) {
    return "rectangular";
  }

  return undefined;
}

function extractSectionDimension(
  prompt: string,
  index: 1 | 2,
): number | undefined {
  const match = prompt.match(
    /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*mm(?:\s*(?:rectangular|section))?/i,
  );

  if (!match) {
    return undefined;
  }

  return Number(match[index]);
}

function extractDiameter(prompt: string): number | undefined {
  const diameter = extractNumber(
    prompt,
    /(?:diameter)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i,
  );

  return diameter === undefined ? undefined : diameter / 2;
}

function extractNumber(prompt: string, pattern: RegExp): number | undefined {
  const match = prompt.match(pattern);
  return match ? Number(match[1]) : undefined;
}
