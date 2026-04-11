export interface DesignActionsInput {
  spanMeters: number;
  supportCondition: "fixed-fixed" | "simply-supported" | "cantilever";
  appliedLoadKnPerM: number;
}

export interface DesignActionsResult {
  ultimateMomentKnM: number;
  ultimateShearKn: number;
}

export interface RcMomentCapacityInput {
  widthMm: number;
  depthMm: number;
  reinforcementAreaMm2: number;
  concreteStrengthMpa?: number;
  steelYieldStrengthMpa?: number;
  coverMm?: number;
  rebarDiameterMm?: number;
  rebarCount?: number;
}

export interface RcShearCapacityInput {
  appliedShearKn?: number;
  appliedMomentKnM?: number;
  axialForceKn?: number;
  widthMm: number;
  effectiveDepthMm: number;
  aggregateSizeMm?: number;
  concreteStrengthMpa: number;
  longitudinalSteelAreaMm2?: number;
  prestressingSteelAreaMm2?: number;
  stirrupAreaMm2?: number;
  stirrupSpacingMm?: number;
  steelYieldStrengthMpa?: number;
  prestressVerticalComponentKn?: number;
  prestressStressMpa?: number;
  prestressFactor?: number;
  elasticModulusSteelMpa?: number;
  elasticModulusPrestressMpa?: number;
  strutAngleDegrees?: number;
}

export interface SteelSectionSearchInput {
  requiredMomentKnM: number;
  spanMeters: number;
}

export interface SteelSectionOption {
  designation: string;
  utilizationRatio: number;
}

export interface StructuralToolAdapters {
  designActions(input: DesignActionsInput): Promise<DesignActionsResult>;
  rcMomentCapacity(input: RcMomentCapacityInput): Promise<{ capacityKnM: number }>;
  rcShearCapacity(input: RcShearCapacityInput): Promise<{ capacityKn: number }>;
  steelSectionSearch(
    input: SteelSectionSearchInput,
  ): Promise<SteelSectionOption[]>;
}

interface RcMomentCapacityAdapterLike {
  calculateRcMomentCapacity(
    input: RcMomentCapacityInput,
  ): Promise<{ capacityKnM: number }>;
}

interface RcShearCapacityAdapterLike {
  calculateRcShearCapacity(
    input: RcShearCapacityInput,
  ): Promise<{ capacityKn: number }>;
}

export class MockDesignActionsAdapter {
  async calculate(input: DesignActionsInput): Promise<DesignActionsResult> {
    const supportFactor =
      input.supportCondition === "fixed-fixed"
        ? 12
        : input.supportCondition === "cantilever"
          ? 2
          : 8;

    return {
      ultimateMomentKnM:
        (input.appliedLoadKnPerM * input.spanMeters ** 2) / supportFactor,
      ultimateShearKn: (input.appliedLoadKnPerM * input.spanMeters) / 2,
    };
  }
}

export class MockStructuralToolAdapters implements StructuralToolAdapters {
  constructor(
    private readonly designActionsAdapter: Pick<
      MockDesignActionsAdapter,
      "calculate"
    > = new MockDesignActionsAdapter(),
    private readonly rcMomentCapacityAdapter: RcMomentCapacityAdapterLike = {
      calculateRcMomentCapacity: async (input: RcMomentCapacityInput) => ({
        capacityKnM:
          (0.87 *
            input.reinforcementAreaMm2 *
            Math.max(input.depthMm - 60, 100)) /
          1_000_000,
      }),
    },
    private readonly rcShearCapacityAdapter: RcShearCapacityAdapterLike = {
      calculateRcShearCapacity: async (input: RcShearCapacityInput) => {
        const concreteContributionKn =
          (0.17 *
            Math.sqrt(input.concreteStrengthMpa) *
            input.widthMm *
            input.effectiveDepthMm) /
          1_000;
        const shearReinforcementContributionKn =
          input.stirrupAreaMm2 && input.stirrupSpacingMm
            ? (0.87 *
                (input.steelYieldStrengthMpa ?? 500) *
                input.stirrupAreaMm2 *
                input.effectiveDepthMm) /
              (input.stirrupSpacingMm * 1_000)
            : 0;

        return {
          capacityKn: concreteContributionKn + shearReinforcementContributionKn,
        };
      },
    },
  ) {}

  async designActions(input: DesignActionsInput): Promise<DesignActionsResult> {
    return this.designActionsAdapter.calculate(input);
  }

  async rcMomentCapacity(
    input: RcMomentCapacityInput,
  ): Promise<{ capacityKnM: number }> {
    return this.rcMomentCapacityAdapter.calculateRcMomentCapacity(input);
  }

  async rcShearCapacity(
    input: RcShearCapacityInput,
  ): Promise<{ capacityKn: number }> {
    return this.rcShearCapacityAdapter.calculateRcShearCapacity(input);
  }

  async steelSectionSearch(
    input: SteelSectionSearchInput,
  ): Promise<SteelSectionOption[]> {
    const baseUtilization =
      input.requiredMomentKnM / Math.max(input.spanMeters * 10, 1);

    return [
      {
        designation: "310UB40.4",
        utilizationRatio: Number((baseUtilization + 0.12).toFixed(2)),
      },
      {
        designation: "360UB44.7",
        utilizationRatio: Number((Math.max(baseUtilization - 0.01, 0.35)).toFixed(2)),
      },
    ];
  }

  private async calculateRcMomentCapacity(
    input: RcMomentCapacityInput,
  ): Promise<{ capacityKnM: number }> {
    return {
      capacityKnM:
        (0.87 * input.reinforcementAreaMm2 * Math.max(input.depthMm - 60, 100)) /
        1_000_000,
    };
  }
}
