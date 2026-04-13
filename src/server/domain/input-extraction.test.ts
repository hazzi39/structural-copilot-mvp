import { describe, expect, it } from "vitest";

import { extractRcBeamRequest } from "@/server/domain/input-extraction";

describe("extractRcBeamRequest", () => {
  it("parses concrete and steel strengths independently from the prompt", () => {
    const result = extractRcBeamRequest({
      prompt:
        "Design a reinforced concrete beam with 50 MPa concrete and 500 MPa reinforcement. The beam spans 5 metres, is fixed at both ends, carries 10 kN/m, and requires moment and shear capacity checks.",
    });

    expect(result.concreteStrengthMpa).toBe(50);
    expect(result.steelYieldStrengthMpa).toBe(500);
  });

  it("parses requested reinforcement and ligatures from the prompt", () => {
    const result = extractRcBeamRequest({
      prompt:
        "Check a reinforced concrete beam using 2N20 bars as reinforcement and N12 ligatures at 150 mm centres. The beam spans 5 metres and carries 10 kN/m.",
    });

    expect(result.requestedRebarCount).toBe(2);
    expect(result.requestedRebarDiameterMm).toBe(20);
    expect(result.requestedStirrupDiameterMm).toBe(12);
    expect(result.requestedStirrupSpacingMm).toBe(150);
  });

  it("parses requested section dimensions from the prompt", () => {
    const result = extractRcBeamRequest({
      prompt:
        "Check a reinforced concrete beam using a 300 x 500 mm section, 2N20 bars, and N12 ligatures at 150 mm centres over a 5 metre span with 10 kN/m load.",
    });

    expect(result.requestedWidthMm).toBe(300);
    expect(result.requestedDepthMm).toBe(500);
  });

  it("parses cover, stirrup leg count, and reinforcement layers from the prompt", () => {
    const result = extractRcBeamRequest({
      prompt:
        "Check a reinforced concrete beam with 50 mm cover, 2N20 bars in 2 layers, and 4N12 ligatures at 125 mm centres over a 5 metre span with 10 kN/m load.",
    });

    expect(result.requestedCoverMm).toBe(50);
    expect(result.requestedRebarLayerCount).toBe(2);
    expect(result.requestedStirrupLegCount).toBe(4);
    expect(result.requestedStirrupDiameterMm).toBe(12);
    expect(result.requestedStirrupSpacingMm).toBe(125);
  });

  it("parses shared N-bar diameter constraints for both main bars and shear bars", () => {
    const result = extractRcBeamRequest({
      prompt:
        "Find an optimal section size and reinforcement for a reinforced concrete beam. The section must span 7 metres and is pinned at both ends supporting a 12 kN/m applied load. Use N12 bars only for both shear and main bars.",
    });

    expect(result.requestedRebarDiameterMm).toBe(12);
    expect(result.requestedStirrupDiameterMm).toBe(12);
  });
});
