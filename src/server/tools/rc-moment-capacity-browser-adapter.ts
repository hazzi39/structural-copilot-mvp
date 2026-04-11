import type { RcMomentCapacityInput } from "@/server/tools/tool-adapters";

export interface RcMomentCapacityBrowserAdapterOptions {
  url?: string;
  timeoutMs?: number;
}

export class RcMomentCapacityBrowserAdapter {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(options: RcMomentCapacityBrowserAdapterOptions = {}) {
    this.url = options.url ?? "https://rcmomentcapacity.netlify.app/";
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async calculate(input: RcMomentCapacityInput): Promise<{ capacityKnM: number }> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(this.timeoutMs);

      await page.goto(this.url, { waitUntil: "networkidle" });

      const rebarDiameter = input.rebarDiameterMm ?? 20;
      const rebarCount =
        input.rebarCount ??
        Math.max(
          1,
          Math.round(
            input.reinforcementAreaMm2 /
              (Math.PI * Math.pow(rebarDiameter / 2, 2)),
          ),
        );

      await page.locator('input[name="fc"]').fill(
        String(input.concreteStrengthMpa ?? 32),
      );
      await page.locator('input[name="fsy"]').fill(
        String(input.steelYieldStrengthMpa ?? 500),
      );
      await page.locator('input[name="b"]').fill(String(input.widthMm));
      await page.locator('input[name="D"]').fill(String(input.depthMm));
      await page.locator('input[name="cover"]').fill(String(input.coverMm ?? 45));
      await page.locator('select[name="rebarDiameter"]').selectOption(
        String(rebarDiameter),
      );
      await page.locator('input[name="rebarCount"]').fill(String(rebarCount));

      await page.getByText("Design Results", { exact: true }).waitFor({
        state: "visible",
      });

      const resultText = await page.locator("body").innerText();
      const match = resultText.match(
        /ULTIMATE MOMENT CAPACITY[\s\S]*?([0-9]+(?:\.[0-9]+)?)\s*kNm/i,
      );

      if (!match) {
        throw new Error("Could not parse moment capacity result from browser tool.");
      }

      return {
        capacityKnM: Number(match[1]),
      };
    } finally {
      await browser.close();
    }
  }

  async calculateRcMomentCapacity(
    input: RcMomentCapacityInput,
  ): Promise<{ capacityKnM: number }> {
    return this.calculate(input);
  }
}

export function getRcMomentCapacityBrowserAdapterFromEnv():
  | RcMomentCapacityBrowserAdapter
  | undefined {
  const enabled = process.env.STRUCTURAL_ENABLE_RC_MOMENT_BROWSER_TOOL;

  if (enabled !== "true") {
    return undefined;
  }

  return new RcMomentCapacityBrowserAdapter({
    url: process.env.STRUCTURAL_RC_MOMENT_TOOL_URL,
  });
}
