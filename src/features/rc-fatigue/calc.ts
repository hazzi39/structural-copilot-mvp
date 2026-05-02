export type StrengthGainType = "highEarly" | "normal" | "delayed";
export type EtaCMode = "conservative" | "calculated";
export type SteelFatigueCategory = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface VariableAmplitudeRowInput {
  id: string;
  label: string;
  mMaxKnM: number;
  mMinKnM: number;
  cycles: number;
}

export interface RcFatigueInput {
  b: number;
  h: number;
  d_t: number;
  d_c: number;
  e_c: number;
  e_s: number;
  f_c: number;
  f_y: number;
  phi_c_fat: number;
  phi_s_fat: number;
  a_st: number;
  a_sc: number;
  db_t: number;
  db_c?: number;
  steelCategory: SteelFatigueCategory;
  mandrelDiameter?: number;
  marineEnvironment: boolean;
  weldedDetail: boolean;
  mMaxKnM: number;
  mMinKnM: number;
  n_sc: number;
  variableAmplitudeRows: VariableAmplitudeRowInput[];
  t0: number;
  strengthGainType: StrengthGainType;
  etaCMode: EtaCMode;
}

export interface FieldWarning {
  code: string;
  message: string;
}

export interface StressState {
  momentKnM: number;
  momentNmm: number;
  sigmaCTop: number;
  sigmaC300: number;
  sigmaSc: number;
  sigmaSt: number;
  topConcreteInCompression: boolean;
}

export interface ConstantAmplitudeConcreteResult {
  applicable: boolean;
  screeningPass: boolean;
  detailedRequired: boolean;
  detailedPass: boolean;
  status: "pass" | "fail";
  sigmaCMax: number;
  sigmaCMin: number;
  sigmaC300: number;
  betaCcT0: number;
  fCFat: number;
  etaC: number;
  etaCRaw?: number;
  sCdMax: number;
  sCdMin: number;
  sCdMinCapped: boolean;
  y?: number;
  logN?: number;
  nResist?: number;
  utilisation: number;
}

export interface ConcreteDamageRow {
  id: string;
  label: string;
  sigmaCMax: number;
  sigmaCMin: number;
  sCdMax: number;
  sCdMin: number;
  logN?: number;
  nResist?: number;
  damage: number;
}

export interface VariableAmplitudeConcreteResult {
  rows: ConcreteDamageRow[];
  totalDamage: number;
  pass: boolean;
}

export interface ConstantAmplitudeSteelResult {
  screeningPass: boolean;
  detailedRequired: boolean;
  pass: boolean;
  deltaSigmaS: number;
  threshold: number;
  nRsk: number;
  mUsed?: number;
  deltaSigmaRskAtNRsk: number;
  deltaSigmaRskN?: number;
  deltaSigmaCapacity?: number;
  utilisation: number;
  k_d?: number;
}

export interface SteelDamageRow {
  id: string;
  label: string;
  deltaSigmaS: number;
  deltaSigmaEff: number;
  mUsed: number;
  nAllowable: number;
  damage: number;
}

export interface VariableAmplitudeSteelResult {
  rows: SteelDamageRow[];
  totalDamage: number;
  pass: boolean;
}

export interface YieldCheckResult {
  maximumStress: number;
  pass: boolean;
}

export interface SectionProperties {
  modularRatio: number;
  transformedCompressionSteelArea: number;
  transformedTensionSteelArea: number;
  neutralAxisDepth: number;
  crackedSecondMoment: number;
}

export interface RcFatigueAnalysis {
  section: SectionProperties;
  stressStates: {
    max: StressState;
    min: StressState;
  };
  concrete: ConstantAmplitudeConcreteResult;
  concreteVariable: VariableAmplitudeConcreteResult;
  steel: ConstantAmplitudeSteelResult;
  steelVariable: VariableAmplitudeSteelResult;
  yieldCheck: YieldCheckResult;
  warnings: FieldWarning[];
}

interface CategoryDefinition {
  nRsk: number;
  m1: number;
  m2: number;
  deltaSigmaRskAtNRsk: number;
  k_d?: number;
}

const STRENGTH_GAIN_FACTOR: Record<StrengthGainType, number> = {
  highEarly: 0.2,
  normal: 0.25,
  delayed: 0.38,
};

export function convertKnMToNmm(value: number) {
  return value * 1_000_000;
}

export function analyzeRcFatigue(input: RcFatigueInput): RcFatigueAnalysis {
  const warnings: FieldWarning[] = [
    {
      code: "TENSION_CONCRETE_IGNORED",
      message: "Concrete tension is ignored in the cracked-section analysis.",
    },
    {
      code: "CODE_REVIEW_REQUIRED",
      message: "Final code compliance still requires verification against the full AS 3600 clauses.",
    },
  ];

  const modularRatio = input.e_s / input.e_c;
  const transformedCompressionSteelArea = modularRatio * input.a_sc;
  const transformedTensionSteelArea = modularRatio * input.a_st;

  const a = 0.5 * input.b;
  const bb = transformedCompressionSteelArea + transformedTensionSteelArea;
  const c =
    -transformedCompressionSteelArea * input.d_c -
    transformedTensionSteelArea * input.d_t;
  const discriminant = bb ** 2 - 4 * a * c;
  const neutralAxisDepth = (-bb + Math.sqrt(discriminant)) / (2 * a);

  if (!(neutralAxisDepth > 0)) {
    throw new Error("Neutral axis depth could not be resolved.");
  }

  if (neutralAxisDepth >= input.d_t) {
    warnings.push({
      code: "NA_OUTSIDE_EXPECTED_RANGE",
      message:
        "The neutral axis is at or below the tensile reinforcement centroid; review section assumptions and inputs.",
    });
  }

  if (input.d_c >= neutralAxisDepth) {
    warnings.push({
      code: "COMPRESSION_STEEL_NOT_IN_COMPRESSION",
      message:
        "Compression reinforcement lies at or below the neutral axis and is not actually in compression for the positive bending case.",
    });
  }

  if (input.mMaxKnM < 0 || input.mMinKnM < 0 || input.mMaxKnM * input.mMinKnM < 0) {
    warnings.push({
      code: "MOMENT_REVERSAL",
      message:
        "Moment reversal or negative bending is present; confirm the reinforcement layer being checked remains the governing fatigue detail.",
    });
  }

  if (input.weldedDetail) {
    warnings.push({
      code: "WELDED_SPLICE_CAUTION",
      message:
        "Welded lap splices should not be used in zones with high fluctuating stress without detailed verification.",
    });
  }

  const crackedSecondMoment =
    (input.b * neutralAxisDepth ** 3) / 3 +
    transformedCompressionSteelArea * (neutralAxisDepth - input.d_c) ** 2 +
    transformedTensionSteelArea * (input.d_t - neutralAxisDepth) ** 2;

  const stressAtMax = getStressState({
    momentKnM: input.mMaxKnM,
    modularRatio,
    neutralAxisDepth,
    crackedSecondMoment,
    d_t: input.d_t,
    d_c: input.d_c,
  });
  const stressAtMin = getStressState({
    momentKnM: input.mMinKnM,
    modularRatio,
    neutralAxisDepth,
    crackedSecondMoment,
    d_t: input.d_t,
    d_c: input.d_c,
  });

  const concrete = getConcreteConstantAmplitudeResult(
    input,
    stressAtMax,
    stressAtMin,
    warnings,
  );
  const concreteVariable = getConcreteVariableAmplitudeResult(
    input,
    warnings,
    modularRatio,
    neutralAxisDepth,
    crackedSecondMoment,
  );

  const steelDefinition = getSteelCategoryDefinition(input);
  const steel = getSteelConstantAmplitudeResult(
    input,
    stressAtMax,
    stressAtMin,
    steelDefinition,
  );
  const steelVariable = getSteelVariableAmplitudeResult(
    input,
    steelDefinition,
    modularRatio,
    neutralAxisDepth,
    crackedSecondMoment,
  );

  const maximumStress = Math.max(
    Math.abs(stressAtMax.sigmaSt),
    Math.abs(stressAtMin.sigmaSt),
    Math.abs(stressAtMax.sigmaSc),
    Math.abs(stressAtMin.sigmaSc),
  );

  return {
    section: {
      modularRatio,
      transformedCompressionSteelArea,
      transformedTensionSteelArea,
      neutralAxisDepth,
      crackedSecondMoment,
    },
    stressStates: {
      max: stressAtMax,
      min: stressAtMin,
    },
    concrete,
    concreteVariable,
    steel,
    steelVariable,
    yieldCheck: {
      maximumStress,
      pass: maximumStress <= input.f_y,
    },
    warnings,
  };
}

function getStressState({
  momentKnM,
  modularRatio,
  neutralAxisDepth,
  crackedSecondMoment,
  d_t,
  d_c,
}: {
  momentKnM: number;
  modularRatio: number;
  neutralAxisDepth: number;
  crackedSecondMoment: number;
  d_t: number;
  d_c: number;
}) : StressState {
  const momentNmm = convertKnMToNmm(momentKnM);
  const sigmaCTop = (momentNmm * neutralAxisDepth) / crackedSecondMoment;
  const sigmaC300 =
    neutralAxisDepth >= 300
      ? (momentNmm * (neutralAxisDepth - 300)) / crackedSecondMoment
      : 0;
  const sigmaSc =
    d_c < neutralAxisDepth
      ? (modularRatio * momentNmm * (neutralAxisDepth - d_c)) / crackedSecondMoment
      : (-modularRatio * momentNmm * (d_c - neutralAxisDepth)) / crackedSecondMoment;
  const sigmaSt =
    (modularRatio * momentNmm * (d_t - neutralAxisDepth)) / crackedSecondMoment;

  return {
    momentKnM,
    momentNmm,
    sigmaCTop,
    sigmaC300,
    sigmaSc,
    sigmaSt,
    topConcreteInCompression: sigmaCTop > 0,
  };
}

function getConcreteConstantAmplitudeResult(
  input: RcFatigueInput,
  stressAtMax: StressState,
  stressAtMin: StressState,
  warnings: FieldWarning[],
): ConstantAmplitudeConcreteResult {
  const compressiveCandidates = [stressAtMax, stressAtMin]
    .map((state) => ({
      sigmaCTop: Math.max(state.sigmaCTop, 0),
      sigmaC300: Math.max(state.sigmaC300, 0),
    }))
    .sort((left, right) => right.sigmaCTop - left.sigmaCTop);

  const sigmaCMax = compressiveCandidates[0]?.sigmaCTop ?? 0;
  const sigmaC300 = compressiveCandidates[0]?.sigmaC300 ?? 0;
  const sigmaCMin = Math.min(
    Math.max(stressAtMax.sigmaCTop, 0),
    Math.max(stressAtMin.sigmaCTop, 0),
  );

  const betaCcT0 = Math.exp(
    STRENGTH_GAIN_FACTOR[input.strengthGainType] * (1 - Math.sqrt(28 / input.t0)),
  );
  const fCFat = 0.85 * betaCcT0 * input.f_c * (1 - input.f_c / 400);

  if (sigmaCMax <= 0) {
    return {
      applicable: false,
      screeningPass: true,
      detailedRequired: false,
      detailedPass: true,
      status: "pass",
      sigmaCMax,
      sigmaCMin,
      sigmaC300,
      betaCcT0,
      fCFat,
      etaC: 1,
      sCdMax: 0,
      sCdMin: 0,
      sCdMinCapped: false,
      utilisation: 0,
    };
  }

  const etaCRaw =
    input.etaCMode === "calculated"
      ? 1 / (1.5 - 0.5 * (sigmaC300 / sigmaCMax))
      : 1;
  const etaC =
    input.etaCMode === "calculated" ? Math.max(etaCRaw, 0.67) : 1;
  const screeningLimit = 0.45 * input.phi_c_fat * fCFat;
  const screeningStress = etaC * sigmaCMax;
  const screeningPass = screeningStress <= screeningLimit;
  const sCdMax = screeningStress / (input.phi_c_fat * fCFat);
  const sCdMinRaw = (etaC * sigmaCMin) / (input.phi_c_fat * fCFat);
  const sCdMin = Math.min(sCdMinRaw, 0.8);

  if (sCdMinRaw > 0.8) {
    warnings.push({
      code: "S_CD_MIN_CAPPED",
      message:
        "S_cd,min exceeded 0.8 and has been capped at 0.8 for the detailed concrete fatigue equations.",
    });
  }

  if (screeningPass) {
    return {
      applicable: true,
      screeningPass: true,
      detailedRequired: false,
      detailedPass: true,
      status: "pass",
      sigmaCMax,
      sigmaCMin,
      sigmaC300,
      betaCcT0,
      fCFat,
      etaC,
      etaCRaw,
      sCdMax,
      sCdMin,
      sCdMinCapped: sCdMinRaw > 0.8,
      utilisation: screeningStress / screeningLimit,
    };
  }

  const fatigueCurve = getConcreteFatigueCurve(sCdMax, sCdMin);
  const pass =
    fatigueCurve.nResist !== undefined ? input.n_sc <= fatigueCurve.nResist : false;

  return {
    applicable: true,
    screeningPass: false,
    detailedRequired: true,
    detailedPass: pass,
    status: pass ? "pass" : "fail",
    sigmaCMax,
    sigmaCMin,
    sigmaC300,
    betaCcT0,
    fCFat,
    etaC,
    etaCRaw,
    sCdMax,
    sCdMin,
    sCdMinCapped: sCdMinRaw > 0.8,
    y: fatigueCurve.y,
    logN: fatigueCurve.logN,
    nResist: fatigueCurve.nResist,
    utilisation:
      fatigueCurve.nResist && fatigueCurve.nResist > 0
        ? input.n_sc / fatigueCurve.nResist
        : Number.POSITIVE_INFINITY,
  };
}

function getConcreteVariableAmplitudeResult(
  input: RcFatigueInput,
  warnings: FieldWarning[],
  modularRatio: number,
  neutralAxisDepth: number,
  crackedSecondMoment: number,
): VariableAmplitudeConcreteResult {
  const rows = input.variableAmplitudeRows.map((row) => {
    const maxState = getStressState({
      momentKnM: row.mMaxKnM,
      modularRatio,
      neutralAxisDepth,
      crackedSecondMoment,
      d_t: input.d_t,
      d_c: input.d_c,
    });
    const minState = getStressState({
      momentKnM: row.mMinKnM,
      modularRatio,
      neutralAxisDepth,
      crackedSecondMoment,
      d_t: input.d_t,
      d_c: input.d_c,
    });
    const constantResult = getConcreteConstantAmplitudeResult(
      { ...input, n_sc: row.cycles },
      maxState,
      minState,
      warnings,
    );

    const nResist = constantResult.nResist;
    const damage =
      nResist && Number.isFinite(nResist) && nResist > 0
        ? row.cycles / nResist
        : constantResult.applicable
          ? Number.POSITIVE_INFINITY
          : 0;

    return {
      id: row.id,
      label: row.label,
      sigmaCMax: constantResult.sigmaCMax,
      sigmaCMin: constantResult.sigmaCMin,
      sCdMax: constantResult.sCdMax,
      sCdMin: constantResult.sCdMin,
      logN: constantResult.logN,
      nResist,
      damage,
    };
  });

  const totalDamage = rows.reduce((sum, row) => sum + row.damage, 0);
  return {
    rows,
    totalDamage,
    pass: totalDamage <= 1,
  };
}

function getSteelConstantAmplitudeResult(
  input: RcFatigueInput,
  stressAtMax: StressState,
  stressAtMin: StressState,
  definition: CategoryDefinition,
): ConstantAmplitudeSteelResult {
  const deltaSigmaS = Math.abs(stressAtMax.sigmaSt - stressAtMin.sigmaSt);
  const threshold = input.weldedDetail || isBentCategory(input.steelCategory) ? 35 : 70;
  const screeningPass = deltaSigmaS <= threshold;

  if (screeningPass) {
    return {
      screeningPass: true,
      detailedRequired: false,
      pass: true,
      deltaSigmaS,
      threshold,
      nRsk: definition.nRsk,
      deltaSigmaRskAtNRsk: definition.deltaSigmaRskAtNRsk,
      utilisation: deltaSigmaS / threshold,
      k_d: definition.k_d,
    };
  }

  const mUsed = input.n_sc <= definition.nRsk ? definition.m1 : definition.m2;
  const deltaSigmaRskN =
    definition.deltaSigmaRskAtNRsk *
    (definition.nRsk / input.n_sc) ** (1 / mUsed);
  const deltaSigmaCapacity = input.phi_s_fat * deltaSigmaRskN;

  return {
    screeningPass: false,
    detailedRequired: true,
    pass: deltaSigmaS <= deltaSigmaCapacity,
    deltaSigmaS,
    threshold,
    nRsk: definition.nRsk,
    mUsed,
    deltaSigmaRskAtNRsk: definition.deltaSigmaRskAtNRsk,
    deltaSigmaRskN,
    deltaSigmaCapacity,
    utilisation: deltaSigmaS / deltaSigmaCapacity,
    k_d: definition.k_d,
  };
}

function getSteelVariableAmplitudeResult(
  input: RcFatigueInput,
  definition: CategoryDefinition,
  modularRatio: number,
  neutralAxisDepth: number,
  crackedSecondMoment: number,
): VariableAmplitudeSteelResult {
  const rows = input.variableAmplitudeRows.map((row) => {
    const maxState = getStressState({
      momentKnM: row.mMaxKnM,
      modularRatio,
      neutralAxisDepth,
      crackedSecondMoment,
      d_t: input.d_t,
      d_c: input.d_c,
    });
    const minState = getStressState({
      momentKnM: row.mMinKnM,
      modularRatio,
      neutralAxisDepth,
      crackedSecondMoment,
      d_t: input.d_t,
      d_c: input.d_c,
    });
    const deltaSigmaS = Math.abs(maxState.sigmaSt - minState.sigmaSt);
    const deltaSigmaEff = deltaSigmaS / input.phi_s_fat;
    const mUsed =
      deltaSigmaEff >= definition.deltaSigmaRskAtNRsk
        ? definition.m1
        : definition.m2;
    const nAllowable =
      deltaSigmaEff > 0
        ? definition.nRsk *
          (definition.deltaSigmaRskAtNRsk / deltaSigmaEff) ** mUsed
        : Number.POSITIVE_INFINITY;

    return {
      id: row.id,
      label: row.label,
      deltaSigmaS,
      deltaSigmaEff,
      mUsed,
      nAllowable,
      damage: row.cycles / nAllowable,
    };
  });

  const totalDamage = rows.reduce((sum, row) => sum + row.damage, 0);
  return {
    rows,
    totalDamage,
    pass: totalDamage <= 1,
  };
}

function getSteelCategoryDefinition(input: RcFatigueInput): CategoryDefinition {
  const db = input.db_t;
  switch (input.steelCategory) {
    case "A":
      return { nRsk: 1_000_000, m1: 5, m2: 9, deltaSigmaRskAtNRsk: 210 };
    case "B":
      return {
        nRsk: 1_000_000,
        m1: 5,
        m2: 9,
        deltaSigmaRskAtNRsk: 240 - 2 * db,
      };
    case "C": {
      const k_d = getMandrelFactor(input.mandrelDiameter, db);
      return {
        nRsk: 1_000_000,
        m1: 5,
        m2: 9,
        deltaSigmaRskAtNRsk: 210 * k_d,
        k_d,
      };
    }
    case "D": {
      const k_d = getMandrelFactor(input.mandrelDiameter, db);
      return {
        nRsk: 1_000_000,
        m1: 5,
        m2: 9,
        deltaSigmaRskAtNRsk: (240 - 2 * db) * k_d,
        k_d,
      };
    }
    case "E":
      return { nRsk: 10_000_000, m1: 3, m2: 5, deltaSigmaRskAtNRsk: 50 };
    case "F":
      return { nRsk: 10_000_000, m1: 3, m2: 5, deltaSigmaRskAtNRsk: 50 };
    case "G":
      return { nRsk: 10_000_000, m1: 3, m2: 5, deltaSigmaRskAtNRsk: 65 };
  }
}

function getMandrelFactor(mandrelDiameter: number | undefined, barDiameter: number) {
  if (!mandrelDiameter || barDiameter <= 0) {
    return 1;
  }

  return Math.min(1, 0.35 + 0.026 * (mandrelDiameter / barDiameter));
}

function isBentCategory(category: SteelFatigueCategory) {
  return category === "C" || category === "D";
}

function getConcreteFatigueCurve(sCdMax: number, sCdMin: number) {
  if (sCdMax <= 0 || sCdMax <= sCdMin || sCdMax >= 1) {
    return { y: undefined, logN: undefined, nResist: undefined };
  }

  const y =
    (0.45 + 1.8 * sCdMin) /
    (1 + (1.8 - 0.3 * sCdMin) * sCdMin);
  const logN1 = (8 / (y - 1)) * (sCdMax - 1);

  let logN = logN1;
  if (logN1 > 8) {
    const denominator = y - sCdMin;
    const ratio = (sCdMax - sCdMin) / denominator;
    if (denominator <= 0 || ratio <= 0) {
      return { y, logN: undefined, nResist: undefined };
    }

    logN =
      8 +
      ((8 * Math.log(10)) / (y - 1)) * denominator * Math.log10(ratio);
  }

  return {
    y,
    logN,
    nResist: 10 ** logN,
  };
}

export function getConcreteBoundaryPoints(
  sCdMin: number,
  count = 20,
): Array<{ logN: number; sCdMax: number }> {
  const points: Array<{ logN: number; sCdMax: number }> = [];
  const upper = 0.995;
  const lower = Math.max(sCdMin + 0.01, 0.1);

  for (let index = 0; index < count; index += 1) {
    const ratio = index / Math.max(count - 1, 1);
    const sCdMax = upper - ratio * (upper - lower);
    const curve = getConcreteFatigueCurve(sCdMax, sCdMin);
    if (curve.logN !== undefined && Number.isFinite(curve.logN)) {
      points.push({ logN: curve.logN, sCdMax });
    }
  }

  return points.sort((left, right) => left.logN - right.logN);
}

export function getSteelBoundaryPoints(
  definition: Pick<CategoryDefinition, "nRsk" | "m1" | "m2" | "deltaSigmaRskAtNRsk">,
  phiSFat: number,
  count = 20,
): Array<{ logN: number; deltaSigma: number }> {
  const minLog = 4;
  const maxLog = 8;
  const points: Array<{ logN: number; deltaSigma: number }> = [];

  for (let index = 0; index < count; index += 1) {
    const logN = minLog + ((maxLog - minLog) * index) / Math.max(count - 1, 1);
    const n = 10 ** logN;
    const m = n <= definition.nRsk ? definition.m1 : definition.m2;
    const deltaSigma =
      phiSFat *
      definition.deltaSigmaRskAtNRsk *
      (definition.nRsk / n) ** (1 / m);
    points.push({ logN, deltaSigma });
  }

  return points;
}

export function getSteelDefinitionSummary(input: RcFatigueInput) {
  return getSteelCategoryDefinition(input);
}
