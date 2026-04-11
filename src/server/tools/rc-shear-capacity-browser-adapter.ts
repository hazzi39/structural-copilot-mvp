import type { RcShearCapacityInput } from "@/server/tools/tool-adapters";

export interface RcShearCapacityBrowserAdapterOptions {
  url?: string;
  timeoutMs?: number;
}

export class RcShearCapacityBrowserAdapter {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(options: RcShearCapacityBrowserAdapterOptions = {}) {
    this.url = options.url ?? "https://concreteshearstrength.netlify.app/";
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async calculateRcShearCapacity(
    input: RcShearCapacityInput,
  ): Promise<{ capacityKn: number }> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(this.timeoutMs);

      await page.goto(this.url, { waitUntil: "networkidle" });

      const values = [
        input.appliedShearKn ?? 0,
        input.appliedMomentKnM ?? 0,
        input.axialForceKn ?? 0,
        input.widthMm,
        input.effectiveDepthMm,
        input.aggregateSizeMm ?? 20,
        input.concreteStrengthMpa,
        input.longitudinalSteelAreaMm2 ?? 0,
        input.prestressingSteelAreaMm2 ?? 0,
        input.stirrupAreaMm2 ?? 0,
        input.stirrupSpacingMm ?? 300,
        input.steelYieldStrengthMpa ?? 500,
        input.prestressVerticalComponentKn ?? 0,
        input.prestressStressMpa ?? 0,
        input.prestressFactor ?? 1.0,
        input.elasticModulusSteelMpa ?? 200000,
        input.elasticModulusPrestressMpa ?? 195000,
        input.strutAngleDegrees ?? 45,
      ];

      const numberInputs = page.locator('input[type="number"]');
      for (let index = 0; index < values.length; index += 1) {
        await numberInputs.nth(index).fill(String(values[index]));
      }

      await page.getByText("Calculated Values", { exact: true }).waitFor({
        state: "visible",
      });

      const resultText = await page.locator("body").innerText();
      const phiVuMatch = resultText.match(
        /DESIGN SHEAR STRENGTH[\s\S]*?φVu:\s*([0-9]+(?:\.[0-9]+)?)\s*kN/i,
      );

      if (!phiVuMatch) {
        throw new Error("Could not parse shear strength result from browser tool.");
      }

      return {
        capacityKn: Number(phiVuMatch[1]),
      };
    } finally {
      await browser.close();
    }
  }
}

export function getRcShearCapacityBrowserAdapterFromEnv():
  | RcShearCapacityBrowserAdapter
  | undefined {
  if (process.env.STRUCTURAL_ENABLE_RC_SHEAR_BROWSER_TOOL !== "true") {
    return undefined;
  }

  return new RcShearCapacityBrowserAdapter({
    url: process.env.STRUCTURAL_RC_SHEAR_TOOL_URL,
  });
}
