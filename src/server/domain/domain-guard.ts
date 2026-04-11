const structuralSignals = [
  "beam",
  "column",
  "slab",
  "footing",
  "foundation",
  "reinforced concrete",
  "concrete",
  "steel section",
  "moment",
  "shear",
  "capacity",
  "load",
  "span",
  "support",
  "deflection",
  "structural",
  "rc",
  "ub",
  "uc",
  "kn/m",
  "section properties",
  "second moment",
  "moment of inertia",
  "centroid",
  "polar moment",
  "i-section",
];

const outOfScopeSignals = [
  "travel",
  "holiday",
  "flight",
  "hotel",
  "politics",
  "president",
  "shopping",
  "buy",
  "coding",
  "python script",
  "javascript",
  "life advice",
  "relationship",
  "diet",
  "recipe",
];

export interface DomainGuardResult {
  allowed: boolean;
  reason?: string;
  matchedSignals: string[];
}

export function evaluateStructuralScope(prompt: string): DomainGuardResult {
  const normalizedPrompt = prompt.toLowerCase();

  const matchedStructuralSignals = structuralSignals.filter((signal) =>
    normalizedPrompt.includes(signal),
  );
  const matchedOutOfScopeSignals = outOfScopeSignals.filter((signal) =>
    normalizedPrompt.includes(signal),
  );

  if (matchedStructuralSignals.length === 0) {
    return {
      allowed: false,
      reason:
        "Prompt is outside the approved structural engineering scope for this copilot.",
      matchedSignals: [],
    };
  }

  if (
    matchedOutOfScopeSignals.length > matchedStructuralSignals.length &&
    matchedStructuralSignals.length < 2
  ) {
    return {
      allowed: false,
      reason:
        "Prompt appears to be primarily about a non-structural topic and was rejected before tool execution.",
      matchedSignals: matchedOutOfScopeSignals,
    };
  }

  return {
    allowed: true,
    matchedSignals: matchedStructuralSignals,
  };
}
