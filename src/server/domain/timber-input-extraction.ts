import type { CopilotQuestionPayload } from "@/types/structural";
import type { TimberMemberCapacityInput } from "@/server/tools/timber-member-browser-adapter";

export interface NormalizedTimberRequest
  extends Omit<
    TimberMemberCapacityInput,
    | "structuralCategory"
    | "loadDuration"
    | "effectiveLengthFactor"
    | "loadRatio"
    | "moistureFactor"
    | "temperatureFactor"
    | "notchFactor"
  > {
  structuralCategory: "1" | "2";
  loadDuration: TimberMemberCapacityInput["loadDuration"];
  effectiveLengthFactor: number;
  loadRatio: number;
  moistureFactor: number;
  temperatureFactor: number;
  notchFactor: number;
}

export function extractTimberRequest(
  payload: CopilotQuestionPayload,
): Partial<NormalizedTimberRequest> {
  const prompt = payload.prompt;

  return {
    timberGrade: extractTimberGrade(prompt),
    structuralCategory: extractStructuralCategory(prompt),
    loadDuration: extractLoadDuration(prompt),
    breadthMm: extractBreadth(prompt),
    depthMm: extractDepth(prompt),
    effectiveLengthMm: extractEffectiveLength(prompt),
    effectiveLengthFactor:
      extractValueAroundLabel(
        prompt,
        /(?:effective length factor|(?:\bk[eE]\b))/i,
      ) ?? 1,
    loadRatio:
      extractValueAroundLabel(prompt, /(?:load ratio|load ratio r|(?:\bratio\b))/i) ??
      0.25,
    moistureFactor:
      extractValueAroundLabel(prompt, /(?:moisture factor|(?:\bk4\b))/i) ?? 1,
    temperatureFactor:
      extractValueAroundLabel(prompt, /(?:temperature factor|(?:\bk6\b))/i) ?? 1,
    notchFactor:
      extractValueAroundLabel(prompt, /(?:notch factor|(?:\bk11\b))/i) ?? 1,
    bendingMomentXKnM: extractBendingMomentX(prompt),
    bendingMomentYKnM: extractBendingMomentY(prompt) ?? 0,
    compressionForceKn:
      extractForce(
        prompt,
        /(?:compression|axial compression|compression force|axial load)/i,
      ) ?? 0,
    tensionForceKn:
      extractForce(prompt, /(?:tension|tension force)/i) ?? 0,
    shearForceKn: extractShear(prompt),
  };
}

export function findMissingTimberInputs(
  request: Partial<NormalizedTimberRequest>,
): string[] {
  const missing: string[] = [];
  if (!request.timberGrade) missing.push("timberGrade");
  if (!request.breadthMm) missing.push("breadthMm");
  if (!request.depthMm) missing.push("depthMm");
  if (!request.effectiveLengthMm) missing.push("effectiveLengthMm");
  if (request.bendingMomentXKnM === undefined) missing.push("bendingMomentXKnM");
  if (request.shearForceKn === undefined) missing.push("shearForceKn");
  return missing;
}

function extractTimberGrade(prompt: string): string | undefined {
  const grades = [
    "F27 Sawn Timber",
    "F22 Sawn Timber",
    "F17 Sawn Timber",
    "F14 Sawn Timber",
    "F11 Sawn Timber",
    "GL18 Glue-Laminated",
    "GL17 Glue-Laminated",
    "GL13 Glue-Laminated",
    "GL12 Glue-Laminated",
    "GL10 Glue-Laminated",
    "A17 Victorian Ash",
    "MGP15 Mechanically Graded Pine",
    "MGP12 Mechanically Graded Pine",
    "MGP10 Mechanically Graded Pine",
  ];

  const upper = prompt.toUpperCase();
  const matched = grades.find((grade) => upper.includes(grade.split(" ")[0]));
  return matched ?? "F14 Sawn Timber";
}

function extractStructuralCategory(prompt: string): "1" | "2" {
  if (/category\s*1|secondary member/i.test(prompt)) {
    return "1";
  }

  return "2";
}

function extractLoadDuration(
  prompt: string,
): TimberMemberCapacityInput["loadDuration"] {
  if (/5 minutes?/i.test(prompt)) return "five_minutes";
  if (/5 hours?/i.test(prompt)) return "five_hours";
  if (/5 days?/i.test(prompt)) return "five_days";
  if (/5 months?/i.test(prompt)) return "five_months";
  return "permanent";
}

function extractBreadth(prompt: string): number | undefined {
  return (
    extractNumber(prompt, /(?:breadth|width)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i) ??
    extractSectionDimension(prompt, 1)
  );
}

function extractDepth(prompt: string): number | undefined {
  return (
    extractNumber(prompt, /(?:depth)\D{0,20}(\d+(?:\.\d+)?)\s*mm/i) ??
    extractSectionDimension(prompt, 2)
  );
}

function extractEffectiveLength(prompt: string): number | undefined {
  const millimeters =
    extractValueAroundLabel(prompt, /(?:effective length|member length|\blength\b)/i, "mm") ??
    extractNumber(prompt, /(\d+(?:\.\d+)?)\s*mm\D{0,20}(?:effective length|member length|\blength\b)/i);

  if (millimeters !== undefined) {
    return millimeters;
  }

  const meters =
    extractValueAroundLabel(prompt, /(?:effective length|member length|\blength\b)/i, "m") ??
    extractNumber(prompt, /(\d+(?:\.\d+)?)\s*m(?!m)\D{0,20}(?:effective length|member length|\blength\b)/i);

  return meters === undefined ? undefined : meters * 1000;
}

function extractBendingMomentX(prompt: string): number | undefined {
  return (
    extractNumber(
      prompt,
      /(\d+(?:\.\d+)?)\s*kN(?:m|·m)\D{0,12}(?:x-axis bending|major axis bending|mx)\b/i,
    ) ??
    extractNumber(
      prompt,
      /(?:x-axis bending|major axis bending|mx)\D{0,12}(\d+(?:\.\d+)?)\s*kN(?:m|·m)/i,
    ) ??
    extractNumber(
      prompt,
      /(?:bending moment)\D{0,12}(\d+(?:\.\d+)?)\s*kN(?:m|·m)/i,
    ) ??
    extractNumber(
      prompt,
      /(\d+(?:\.\d+)?)\s*kN(?:m|·m)\D{0,12}(?:bending moment)\b/i,
    ) ??
    extractNumber(prompt, /(\d+(?:\.\d+)?)\s*kN(?:m|·m)(?!\D{0,20}y-axis bending)/i)
  );
}

function extractBendingMomentY(prompt: string): number | undefined {
  return (
    extractNumber(
      prompt,
      /(\d+(?:\.\d+)?)\s*kN(?:m|·m)\D{0,12}(?:y-axis bending|minor axis bending|my)\b/i,
    ) ??
    extractNumber(
      prompt,
      /(?:y-axis bending|minor axis bending|my)\D{0,12}(\d+(?:\.\d+)?)\s*kN(?:m|·m)/i,
    )
  );
}

function extractShear(prompt: string): number | undefined {
  return (
    extractNumber(prompt, /(\d+(?:\.\d+)?)\s*kN\D{0,12}(?:shear|shear force|v\*)\b/i) ??
    extractNumber(prompt, /(?:shear|shear force|v\*)\D{0,12}(\d+(?:\.\d+)?)\s*kN/i)
  );
}

function extractSectionDimension(
  prompt: string,
  index: 1 | 2,
): number | undefined {
  const match = prompt.match(
    /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*mm(?:\s*(?:timber|member|section))?/i,
  );

  if (!match) {
    return undefined;
  }

  return Number(match[index]);
}

function extractNumber(prompt: string, pattern: RegExp): number | undefined {
  const match = prompt.match(pattern);
  return match ? Number(match[1]) : undefined;
}

function extractValueAroundLabel(
  prompt: string,
  labelPattern: RegExp,
  unit?: "mm" | "m",
): number | undefined {
  const labelSource = stripFlags(labelPattern);
  const unitPattern = unit === undefined ? "" : `\\s*${unit === "m" ? "m(?!m)" : unit}`;

  const after = extractNumber(
    prompt,
    new RegExp(`${labelSource}\\D{0,25}(\\d+(?:\\.\\d+)?)${unitPattern}`, "i"),
  );

  if (after !== undefined) {
    return after;
  }

  return extractNumber(
    prompt,
    new RegExp(`(\\d+(?:\\.\\d+)?)${unitPattern}\\D{0,25}${labelSource}`, "i"),
  );
}

function extractForce(prompt: string, labelPattern: RegExp): number | undefined {
  const labelSource = stripFlags(labelPattern);

  return extractNumber(
    prompt,
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*kN\\D{0,12}${labelSource}`, "i"),
  ) ?? extractNumber(
    prompt,
    new RegExp(`${labelSource}\\D{0,12}(\\d+(?:\\.\\d+)?)\\s*kN`, "i"),
  );
}

function stripFlags(pattern: RegExp): string {
  return pattern.source;
}
