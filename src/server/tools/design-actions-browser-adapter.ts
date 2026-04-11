import type {
  DesignActionsInput,
  DesignActionsResult,
} from "@/server/tools/tool-adapters";

const supportConditionOptionMap: Record<
  DesignActionsInput["supportCondition"],
  string
> = {
  "fixed-fixed": "Fixed-Fixed, Uniform Distributed Load",
  "simply-supported": "Simply Supported, Uniform Distributed Load",
  cantilever: "Cantilever, Uniform Distributed Load",
};

export interface DesignActionsBrowserAdapterOptions {
  url?: string;
  timeoutMs?: number;
  sectionType?: string;
  designation?: string;
}

export class DesignActionsBrowserAdapter {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly sectionType: string;
  private readonly designation: string;

  constructor(options: DesignActionsBrowserAdapterOptions = {}) {
    this.url = options.url ?? "https://designactionspremium.netlify.app/";
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.sectionType = options.sectionType ?? "Universal Beams";
    this.designation = options.designation ?? "310UB40.4";
  }

  async calculate(input: DesignActionsInput): Promise<DesignActionsResult> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(this.timeoutMs);

      await page.goto(this.url, { waitUntil: "networkidle" });

      const selects = page.locator("select");
      await selects.nth(0).selectOption({ label: this.sectionType });
      await page.waitForTimeout(200);
      await selects.nth(1).selectOption({ label: this.designation });
      await page.waitForTimeout(200);
      await selects
        .nth(2)
        .selectOption({ label: supportConditionOptionMap[input.supportCondition] });

      await page.locator('input[type="number"]').nth(0).fill(
        String(input.appliedLoadKnPerM),
      );
      await page.locator('input[type="number"]').nth(1).fill(
        String(input.spanMeters),
      );

      await page.waitForTimeout(750);

      const bodyText = await page.locator("body").innerText();
      const shearMatch = bodyText.match(/Vmax\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*kN/i);
      const hoggingMatch = bodyText.match(
        /Mhog\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*kN[⋅.]m/i,
      );
      const saggingMatch = bodyText.match(
        /Msag\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*kN[⋅.]m/i,
      );
      const maxMomentMatch = bodyText.match(
        /Mmax\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*kN[⋅.]m/i,
      );

      if (!shearMatch) {
        throw new Error("Could not parse Vmax from design actions browser tool.");
      }

      const candidateMoments = [hoggingMatch, saggingMatch, maxMomentMatch]
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map((match) => Number(match[1]));

      if (candidateMoments.length === 0) {
        throw new Error("Could not parse moment result from design actions browser tool.");
      }

      return {
        ultimateMomentKnM: Math.max(...candidateMoments),
        ultimateShearKn: Number(shearMatch[1]),
      };
    } finally {
      await browser.close();
    }
  }
}

export function getDesignActionsBrowserAdapterFromEnv():
  | DesignActionsBrowserAdapter
  | undefined {
  if (process.env.STRUCTURAL_ENABLE_DESIGN_ACTIONS_BROWSER_TOOL !== "true") {
    return undefined;
  }

  return new DesignActionsBrowserAdapter({
    url: process.env.STRUCTURAL_DESIGN_ACTIONS_BROWSER_TOOL_URL,
  });
}
