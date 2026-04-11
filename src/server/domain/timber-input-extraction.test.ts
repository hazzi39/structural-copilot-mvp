import { describe, expect, it } from "vitest";

import {
  extractTimberRequest,
  findMissingTimberInputs,
} from "@/server/domain/timber-input-extraction";

describe("extractTimberRequest", () => {
  it("extracts timber geometry, modifiers, and demands from the prompt", () => {
    const request = extractTimberRequest({
      prompt:
        "Check a timber member using F17 timber in category 1 with 190 x 45 mm section, 3.6 m effective length, ke 1.2, load ratio 0.4, k4 0.95, k6 0.9, k11 0.85, 5 days load duration, 8.5 kNm x-axis bending, 2.1 kNm y-axis bending, 25 kN compression, 5 kN tension, and 15 kN shear.",
    });

    expect(request).toMatchObject({
      timberGrade: "F17 Sawn Timber",
      structuralCategory: "1",
      loadDuration: "five_days",
      breadthMm: 190,
      depthMm: 45,
      effectiveLengthMm: 3600,
      effectiveLengthFactor: 1.2,
      loadRatio: 0.4,
      moistureFactor: 0.95,
      temperatureFactor: 0.9,
      notchFactor: 0.85,
      bendingMomentXKnM: 8.5,
      bendingMomentYKnM: 2.1,
      compressionForceKn: 25,
      tensionForceKn: 5,
      shearForceKn: 15,
    });
  });

  it("supports explicit breadth and depth wording", () => {
    const request = extractTimberRequest({
      prompt:
        "Assess an MGP12 timber member with breadth 90 mm, depth 240 mm, effective length 4200 mm, 6.2 kNm bending moment, and 11 kN shear.",
    });

    expect(request.breadthMm).toBe(90);
    expect(request.depthMm).toBe(240);
    expect(request.effectiveLengthMm).toBe(4200);
    expect(request.bendingMomentXKnM).toBe(6.2);
    expect(request.shearForceKn).toBe(11);
  });
});

describe("findMissingTimberInputs", () => {
  it("returns no missing fields when the minimum timber request is present", () => {
    const missing = findMissingTimberInputs({
      timberGrade: "F14 Sawn Timber",
      breadthMm: 190,
      depthMm: 45,
      effectiveLengthMm: 3600,
      bendingMomentXKnM: 8.5,
      shearForceKn: 15,
    });

    expect(missing).toEqual([]);
  });
});
