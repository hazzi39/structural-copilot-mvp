import { describe, expect, it } from "vitest";

import { MockStructuralToolAdapters } from "@/server/tools/tool-adapters";

describe("MockStructuralToolAdapters", () => {
  it("returns a realistic preliminary RC moment capacity when browser tools are unavailable", async () => {
    const tools = new MockStructuralToolAdapters();

    const result = await tools.rcMomentCapacity({
      widthMm: 350,
      depthMm: 650,
      reinforcementAreaMm2: 5 * Math.PI * Math.pow(24 / 2, 2),
      concreteStrengthMpa: 32,
      steelYieldStrengthMpa: 500,
      coverMm: 45,
      rebarDiameterMm: 24,
      rebarCount: 5,
    });

    expect(result.capacityKnM).toBeGreaterThan(500);
    expect(result.capacityKnM).toBeLessThan(700);
  });
});
