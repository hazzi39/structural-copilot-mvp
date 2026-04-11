import type {
  CopilotQuestionPayload,
  MaterialFamily,
  StructuredEngineeringInputs,
  SupportCondition,
} from "@/types/structural";

export interface NormalizedRcBeamRequest {
  spanMeters?: number;
  appliedLoadKnPerM?: number;
  supportCondition?: SupportCondition;
  materialFamily: MaterialFamily;
  concreteStrengthMpa?: number;
  steelYieldStrengthMpa?: number;
  requestedCoverMm?: number;
  requestedWidthMm?: number;
  requestedDepthMm?: number;
  requestedRebarCount?: number;
  requestedRebarDiameterMm?: number;
  requestedRebarLayerCount?: number;
  requestedStirrupDiameterMm?: number;
  requestedStirrupLegCount?: number;
  requestedStirrupSpacingMm?: number;
  requiresMomentCheck: boolean;
  requiresShearCheck: boolean;
  requiresSteelAlternative: boolean;
}

const supportMappings: Array<{ pattern: RegExp; value: SupportCondition }> = [
  { pattern: /\bfixed at both ends\b|\bfixed[- ]ended\b|\bfixed-fixed\b/i, value: "fixed-fixed" },
  { pattern: /\bsimply supported\b|\bsimply-supported\b/i, value: "simply-supported" },
  { pattern: /\bcantilever\b/i, value: "cantilever" },
];

export function extractRcBeamRequest(
  payload: CopilotQuestionPayload,
): NormalizedRcBeamRequest {
  const prompt = payload.prompt;
  const spanMeters =
    payload.structuredInputs?.spanMeters ?? extractFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*m(?:et(?:re|er)s?)?\b/i);
  const appliedLoadKnPerM =
    payload.structuredInputs?.appliedLoadKnPerM ??
    extractFirstNumber(prompt, /(\d+(?:\.\d+)?)\s*k(?:ilo)?n(?:ewton)?\/m\b/i);
  const supportCondition =
    payload.structuredInputs?.supportCondition ?? extractSupportCondition(prompt);

  const materialFamily =
    payload.structuredInputs?.materialFamily ??
    (/\bsteel\b/i.test(prompt) && !/\bconcrete\b|\brc\b/i.test(prompt)
      ? "steel"
      : "reinforced_concrete");
  const concreteStrengthMpa = extractStrengthNearKeywords(prompt, [
    "concrete",
    "f'?c",
    "compressive strength",
  ]);
  const steelYieldStrengthMpa = extractStrengthNearKeywords(prompt, [
    "steel",
    "reinforcement",
    "rebar",
    "fsy",
    "yield strength",
  ]);
  const requestedCoverMm = extractFirstNumber(
    prompt,
    /(?:cover|clear cover)[^\d]{0,20}(\d+(?:\.\d+)?)\s*mm|(\d+(?:\.\d+)?)\s*mm[^\w]{0,10}(?:cover|clear cover)/i,
  );
  const requestedSectionSize = extractSectionSize(prompt);
  const requestedRebar = extractMainRebar(prompt);
  const requestedRebarLayerCount = extractFirstNumber(
    prompt,
    /(\d+)\s*(?:layers?|rows?)[^.]{0,25}(?:bars?|reinforcement|reo)|(?:bars?|reinforcement|reo)[^.]{0,25}(\d+)\s*(?:layers?|rows?)/i,
  );
  const requestedStirrups = extractStirrups(prompt);
  const requestedStirrupSpacingMm = extractFirstNumber(
    prompt,
    /(?:ligatures?|stirrups?|ties?)[^\d]{0,20}?(?:@|at)\s*(\d+(?:\.\d+)?)\s*mm/i,
  );

  return {
    spanMeters,
    appliedLoadKnPerM,
    supportCondition,
    materialFamily,
    concreteStrengthMpa,
    steelYieldStrengthMpa,
    requestedCoverMm,
    requestedWidthMm: requestedSectionSize?.widthMm,
    requestedDepthMm: requestedSectionSize?.depthMm,
    requestedRebarCount: requestedRebar?.count,
    requestedRebarDiameterMm: requestedRebar?.diameterMm,
    requestedRebarLayerCount,
    requestedStirrupDiameterMm: requestedStirrups?.diameterMm,
    requestedStirrupLegCount: requestedStirrups?.count,
    requestedStirrupSpacingMm,
    requiresMomentCheck: /\bmoment\b/i.test(prompt) || /\bcapacity\b/i.test(prompt),
    requiresShearCheck: /\bshear\b/i.test(prompt) || /\bcapacity\b/i.test(prompt),
    requiresSteelAlternative: /\balternative steel\b/i.test(prompt) || /\bsteel section\b/i.test(prompt),
  };
}

export function findMissingRcBeamInputs(
  request: NormalizedRcBeamRequest,
): string[] {
  const missing: string[] = [];

  if (!request.spanMeters) {
    missing.push("spanMeters");
  }
  if (!request.appliedLoadKnPerM) {
    missing.push("appliedLoadKnPerM");
  }
  if (!request.supportCondition) {
    missing.push("supportCondition");
  }

  return missing;
}

function extractSupportCondition(prompt: string): SupportCondition | undefined {
  const match = supportMappings.find(({ pattern }) => pattern.test(prompt));
  return match?.value;
}

function extractFirstNumber(
  prompt: string,
  pattern: RegExp,
): number | undefined {
  const match = prompt.match(pattern);
  if (!match) {
    return undefined;
  }

  const value = match[1] ?? match[2];
  return value ? Number(value) : undefined;
}

function extractStrengthNearKeywords(
  prompt: string,
  keywords: string[],
): number | undefined {
  const keywordPattern = keywords.join("|");

  const numberBeforeKeyword = extractFirstNumber(
    prompt,
    new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*MPa\\s*(?:${keywordPattern})\\b`,
      "i",
    ),
  );

  if (numberBeforeKeyword !== undefined) {
    return numberBeforeKeyword;
  }

  return extractFirstNumber(
    prompt,
    new RegExp(
      `(?:${keywordPattern})[^\\d]{0,25}(\\d+(?:\\.\\d+)?)\\s*MPa`,
      "i",
    ),
  );
}

function extractSectionSize(
  prompt: string,
): { widthMm: number; depthMm: number } | undefined {
  const compactMatch = prompt.match(
    /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*mm/i,
  );

  if (compactMatch) {
    return {
      widthMm: Number(compactMatch[1]),
      depthMm: Number(compactMatch[2]),
    };
  }

  const widthMatch = prompt.match(
    /(?:width|wide|b)[^\d]{0,20}(\d+(?:\.\d+)?)\s*mm/i,
  );
  const depthMatch = prompt.match(
    /(?:depth|deep|overall depth|D)[^\d]{0,20}(\d+(?:\.\d+)?)\s*mm/i,
  );

  if (!widthMatch && !depthMatch) {
    return undefined;
  }

  return {
    widthMm: widthMatch ? Number(widthMatch[1]) : undefined,
    depthMm: depthMatch ? Number(depthMatch[1]) : undefined,
  } as { widthMm: number; depthMm: number };
}

function extractMainRebar(
  prompt: string,
): { count: number; diameterMm: number } | undefined {
  const keywordWindow = extractKeywordWindow(prompt, [
    "bars?",
    "reinforcement",
    "reinforcing",
    "main reo",
    "main reinforcement",
  ]);
  const match = keywordWindow?.match(
    /(\d+)\s*[Nn]\s*(\d+(?:\.\d+)?)/,
  );

  if (!match) {
    return undefined;
  }

  const count = match[1];
  const diameter = match[2];

  if (!count || !diameter) {
    return undefined;
  }

  return {
    count: Number(count),
    diameterMm: Number(diameter),
  };
}

function extractStirrups(
  prompt: string,
): { count: number; diameterMm: number } | undefined {
  const keywordWindow = extractKeywordWindow(prompt, [
    "ligatures?",
    "stirrups?",
    "ties?",
    "shear reinforcement",
  ]);

  const explicitCountMatch = keywordWindow?.match(
    /(\d+)\s*[Nn]\s*(\d+(?:\.\d+)?)/,
  );

  if (explicitCountMatch) {
    const count = explicitCountMatch[1];
    const diameter = explicitCountMatch[2];

    if (count && diameter) {
      return {
        count: Number(count),
        diameterMm: Number(diameter),
      };
    }
  }

  const diameterOnlyMatch = keywordWindow?.match(
    /[Nn]\s*(\d+(?:\.\d+)?)/,
  );

  if (!diameterOnlyMatch) {
    return undefined;
  }

  const diameter = diameterOnlyMatch[1];

  if (!diameter) {
    return undefined;
  }

  return {
    count: 2,
    diameterMm: Number(diameter),
  };
}

function extractKeywordWindow(prompt: string, keywords: string[]): string | undefined {
  const pattern = new RegExp(keywords.join("|"), "i");
  const match = pattern.exec(prompt);

  if (!match || match.index === undefined) {
    return undefined;
  }

  const start = Math.max(0, match.index - 30);
  const end = Math.min(prompt.length, match.index + 60);
  return prompt.slice(start, end);
}

export function mergeStructuredInputs(
  base: StructuredEngineeringInputs | undefined,
  normalized: NormalizedRcBeamRequest,
): StructuredEngineeringInputs {
  return {
    ...base,
    spanMeters: normalized.spanMeters ?? base?.spanMeters,
    supportCondition: normalized.supportCondition ?? base?.supportCondition,
    appliedLoadKnPerM: normalized.appliedLoadKnPerM ?? base?.appliedLoadKnPerM,
    materialFamily: normalized.materialFamily ?? base?.materialFamily,
  };
}
