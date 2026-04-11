export interface TimberMemberCapacityInput {
  timberGrade: string;
  structuralCategory: "1" | "2";
  loadDuration:
    | "five_minutes"
    | "five_hours"
    | "five_days"
    | "five_months"
    | "permanent";
  breadthMm: number;
  depthMm: number;
  effectiveLengthMm: number;
  effectiveLengthFactor: number;
  loadRatio: number;
  moistureFactor: number;
  temperatureFactor: number;
  notchFactor: number;
  bendingMomentXKnM: number;
  bendingMomentYKnM: number;
  compressionForceKn: number;
  tensionForceKn: number;
  shearForceKn: number;
}

export interface TimberMemberCapacityResult {
  bendingCapacityXKnM: number;
  bendingCapacityYKnM: number;
  compressionCapacityKn: number;
  tensionCapacityKn: number;
  shearCapacityKn: number;
  durationFactor: number;
  moistureFactor: number;
  temperatureFactor: number;
  notchFactor: number;
  beamStabilityFactor: number;
  unityBendingX: number;
  unityShear: number;
}

export interface TimberMemberBrowserAdapterOptions {
  url?: string;
  timeoutMs?: number;
}

const loadDurationOptionMap: Record<
  TimberMemberCapacityInput["loadDuration"],
  string
> = {
  five_minutes: "5 minutes",
  five_hours: "5 hours",
  five_days: "5 days",
  five_months: "5 months",
  permanent: "Permanent",
};

export class TimberMemberBrowserAdapter {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(options: TimberMemberBrowserAdapterOptions = {}) {
    this.url = options.url ?? "https://timbercapacityprem.netlify.app/";
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async calculate(
    input: TimberMemberCapacityInput,
  ): Promise<TimberMemberCapacityResult> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(this.timeoutMs);

      await page.goto(this.url, { waitUntil: "networkidle" });

      const selects = page.locator("select");
      await selects.nth(0).selectOption({ label: input.timberGrade });
      await selects
        .nth(1)
        .selectOption({ value: input.structuralCategory });
      await selects
        .nth(2)
        .selectOption({ label: loadDurationOptionMap[input.loadDuration] });

      const numericValues = [
        input.breadthMm,
        input.depthMm,
        input.effectiveLengthMm,
        input.effectiveLengthFactor,
        input.loadRatio,
        input.moistureFactor,
        input.temperatureFactor,
        input.notchFactor,
        input.bendingMomentXKnM,
        input.bendingMomentYKnM,
        input.compressionForceKn,
        input.tensionForceKn,
        input.shearForceKn,
        0,
        0,
        0,
        0,
        0,
        0,
      ];

      const inputs = page.locator('input[type="number"]');
      for (let index = 0; index < numericValues.length; index += 1) {
        await inputs.nth(index).fill(String(numericValues[index]));
      }

      await page.getByText("Calculation Results", { exact: true }).waitFor({
        state: "visible",
      });

      const bodyText = await page.locator("body").innerText();

      return {
        bendingCapacityXKnM: parseLabeledValue(bodyText, /φMₓ\s*([\d.]+)\s*kNm/i),
        bendingCapacityYKnM: parseLabeledValue(bodyText, /φMᵧ\s*([\d.]+)\s*kNm/i),
        compressionCapacityKn: parseLabeledValue(bodyText, /φN\s*([\d.]+)\s*kN/i),
        tensionCapacityKn: parseLabeledValue(bodyText, /φNₜ\s*([\d.]+)\s*kN/i),
        shearCapacityKn: parseLabeledValue(bodyText, /φV\s*([\d.]+)\s*kN/i),
        durationFactor: parseLabeledValue(bodyText, /Duration \(k₁\)\s*([\d.]+)/i),
        moistureFactor: parseLabeledValue(bodyText, /Moisture \(k₄\)\s*([\d.]+)/i),
        temperatureFactor: parseLabeledValue(bodyText, /Temperature \(k₆\)\s*([\d.]+)/i),
        notchFactor: parseLabeledValue(bodyText, /Notch \(k₁₁\)\s*([\d.]+)/i),
        beamStabilityFactor: parseLabeledValue(bodyText, /Beam Stability \(k₁₂\)\s*([\d.]+)/i),
        unityBendingX: parseLabeledValue(
          bodyText,
          /Bending \(x-axis\)\s*[\d.]+\s*kNm\s*[\d.]+\s*kNm\s*([\d.]+)/i,
        ),
        unityShear: parseLabeledValue(
          bodyText,
          /Shear\s*[\d.]+\s*kN\s*[\d.]+\s*kN\s*([\d.]+)/i,
        ),
      };
    } finally {
      await browser.close();
    }
  }
}

export function getTimberMemberBrowserAdapterFromEnv():
  | TimberMemberBrowserAdapter
  | undefined {
  if (process.env.STRUCTURAL_ENABLE_TIMBER_BROWSER_TOOL !== "true") {
    return undefined;
  }

  return new TimberMemberBrowserAdapter({
    url: process.env.STRUCTURAL_TIMBER_TOOL_URL,
  });
}

function parseLabeledValue(bodyText: string, pattern: RegExp): number {
  const match = bodyText.match(pattern);
  if (!match) {
    throw new Error(`Could not parse timber tool value for pattern: ${pattern}`);
  }

  return Number(match[1]);
}
