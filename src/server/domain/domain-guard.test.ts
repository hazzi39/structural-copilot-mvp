import { describe, expect, it } from "vitest";

import { evaluateStructuralScope } from "@/server/domain/domain-guard";

describe("evaluateStructuralScope", () => {
  it("allows structural engineering prompts", () => {
    const result = evaluateStructuralScope(
      "Check moment and shear capacity for a reinforced concrete beam spanning 5 m with fixed supports.",
    );

    expect(result.allowed).toBe(true);
  });

  it("allows section property prompts", () => {
    const result = evaluateStructuralScope(
      "Calculate the section properties, centroid, and second moment of area for a 300 x 600 mm rectangular section.",
    );

    expect(result.allowed).toBe(true);
  });

  it("rejects clearly non-structural prompts", () => {
    const result = evaluateStructuralScope(
      "Help me plan travel, shopping, and hotels for my summer holiday.",
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("outside");
  });
});
