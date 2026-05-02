import { describe, expect, it } from "vitest";

import {
  analyzeRcFatigue,
  convertKnMToNmm,
  getConcreteBoundaryPoints,
  getSteelBoundaryPoints,
  getSteelDefinitionSummary,
  type RcFatigueInput,
} from "@/features/rc-fatigue/calc";

const baseInput: RcFatigueInput = {
  b: 300,
  h: 600,
  d_t: 540,
  d_c: 60,
  e_c: 30000,
  e_s: 200000,
  f_c: 40,
  f_y: 500,
  phi_c_fat: 0.6,
  phi_s_fat: 0.85,
  a_st: 1963,
  a_sc: 804,
  db_t: 25,
  db_c: 20,
  steelCategory: "B",
  mandrelDiameter: 100,
  marineEnvironment: false,
  weldedDetail: false,
  mMaxKnM: 180,
  mMinKnM: 45,
  n_sc: 200000,
  variableAmplitudeRows: [
    { id: "1", label: "Case 1", mMaxKnM: 180, mMinKnM: 45, cycles: 120000 },
    { id: "2", label: "Case 2", mMaxKnM: 150, mMinKnM: 20, cycles: 80000 },
  ],
  t0: 28,
  strengthGainType: "normal",
  etaCMode: "calculated",
};

describe("rc fatigue calculations", () => {
  it("converts kN.m to N.mm", () => {
    expect(convertKnMToNmm(180)).toBe(180000000);
  });

  it("returns stable cracked section properties", () => {
    const result = analyzeRcFatigue(baseInput);

    expect(result.section.modularRatio).toBeCloseTo(6.6667, 4);
    expect(result.section.neutralAxisDepth).toBeCloseTo(168.81, 2);
    expect(result.section.crackedSecondMoment).toBeGreaterThan(2e9);
    expect(result.stressStates.max.sigmaSt).toBeGreaterThan(result.stressStates.min.sigmaSt);
  });

  it("builds concrete and steel fatigue summaries", () => {
    const result = analyzeRcFatigue(baseInput);

    expect(result.concrete.applicable).toBe(true);
    expect(result.concrete.utilisation).toBeGreaterThan(0);
    expect(result.steel.deltaSigmaS).toBeGreaterThan(0);
    expect(result.steelVariable.rows).toHaveLength(2);
  });

  it("produces plot-ready boundary points", () => {
    const definition = getSteelDefinitionSummary(baseInput);
    const concretePoints = getConcreteBoundaryPoints(0.2);
    const steelPoints = getSteelBoundaryPoints(definition, baseInput.phi_s_fat);

    expect(concretePoints.length).toBeGreaterThan(4);
    expect(steelPoints.length).toBeGreaterThan(4);
    expect(steelPoints[0]?.deltaSigma).toBeGreaterThan(steelPoints.at(-1)?.deltaSigma ?? 0);
  });
});
