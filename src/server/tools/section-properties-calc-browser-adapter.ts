import type { Page } from "playwright";

import type { AdvancedSectionPropertyInput } from "@/server/tools/advanced-section-property-browser-adapter";

export interface SectionPropertiesCalcResult {
  areaMm2: number;
  centroidXMm: number;
  centroidYMm: number;
  ixxMm4: number;
  iyyMm4: number;
  elasticModulusXMm3: number;
  elasticModulusYMm3: number;
  plasticModulusXMm3: number;
  plasticModulusYMm3: number;
  radiusOfGyrationXMm: number;
  radiusOfGyrationYMm: number;
}

export interface SectionPropertiesCalcBrowserAdapterOptions {
  url?: string;
  timeoutMs?: number;
}

export class SectionPropertiesCalcBrowserAdapter {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(options: SectionPropertiesCalcBrowserAdapterOptions = {}) {
    this.url = options.url ?? "https://sectionpropertiescalc.netlify.app/";
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async calculate(
    input: AdvancedSectionPropertyInput,
  ): Promise<SectionPropertiesCalcResult> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(this.timeoutMs);

      await page.goto(this.url, { waitUntil: "networkidle" });
      await selectShape(page, input);
      await fillInputs(page, input);
      await page.waitForTimeout(600);

      const bodyText = await page.locator("body").innerText();

      return {
        areaMm2: parseValue(bodyText, /Area[\s\S]*?:\s*([\d.+\-eE]+)\s*mm²/i),
        centroidXMm: parseValue(bodyText, /Centroid[\s\S]*?x[\s\S]*?:\s*([\d.+\-eE]+)\s*mm/i),
        centroidYMm: parseValue(bodyText, /Centroid[\s\S]*?y[\s\S]*?:\s*([\d.+\-eE]+)\s*mm/i),
        ixxMm4: parseValue(bodyText, /Second Moment of Area[\s\S]*?I[\s\S]*?x[\s\S]*?:\s*([\d.+\-eE]+)\s*mm⁴/i),
        iyyMm4: parseValue(bodyText, /Second Moment of Area[\s\S]*?I[\s\S]*?y[\s\S]*?:\s*([\d.+\-eE]+)\s*mm⁴/i),
        elasticModulusXMm3: parseValue(bodyText, /Elastic Section Modulus[\s\S]*?Z[\s\S]*?x[\s\S]*?:\s*([\d.+\-eE]+)\s*mm³/i),
        elasticModulusYMm3: parseValue(bodyText, /Elastic Section Modulus[\s\S]*?Z[\s\S]*?y[\s\S]*?:\s*([\d.+\-eE]+)\s*mm³/i),
        plasticModulusXMm3: parseValue(bodyText, /Plastic Section Modulus[\s\S]*?S[\s\S]*?x[\s\S]*?:\s*([\d.+\-eE]+)\s*mm³/i),
        plasticModulusYMm3: parseValue(bodyText, /Plastic Section Modulus[\s\S]*?S[\s\S]*?y[\s\S]*?:\s*([\d.+\-eE]+)\s*mm³/i),
        radiusOfGyrationXMm: parseValue(bodyText, /Radius of Gyration[\s\S]*?r[\s\S]*?x[\s\S]*?:\s*([\d.+\-eE]+)\s*mm/i),
        radiusOfGyrationYMm: parseValue(bodyText, /Radius of Gyration[\s\S]*?r[\s\S]*?y[\s\S]*?:\s*([\d.+\-eE]+)\s*mm/i),
      };
    } finally {
      await browser.close();
    }
  }
}

async function selectShape(
  page: Page,
  input: AdvancedSectionPropertyInput,
) {
  const value =
    input.shapeType === "rectangular"
      ? "solidRectangle"
      : input.shapeType === "circular"
        ? "solidCircle"
        : "iSection";

  await page.locator("select").selectOption(value);
}

async function fillInputs(
  page: Page,
  input: AdvancedSectionPropertyInput,
) {
  const values =
    input.shapeType === "rectangular"
      ? [input.widthMm, input.heightMm]
      : input.shapeType === "circular"
        ? [input.radiusMm]
        : [
            input.flangeWidthMm,
            input.flangeThicknessMm,
            input.webThicknessMm,
            input.webHeightMm && input.flangeThicknessMm
              ? input.webHeightMm + input.flangeThicknessMm * 2
              : undefined,
            input.webHeightMm,
          ];

  const inputs = page.locator('input[type="number"]');
  for (let index = 0; index < values.length; index += 1) {
    await inputs.nth(index).fill(String(values[index] ?? ""));
  }
}

export function getSectionPropertiesCalcBrowserAdapterFromEnv():
  | SectionPropertiesCalcBrowserAdapter
  | undefined {
  if (
    process.env.STRUCTURAL_ENABLE_SECTION_PROPERTIES_CALC_BROWSER_TOOL !==
    "true"
  ) {
    return undefined;
  }

  return new SectionPropertiesCalcBrowserAdapter({
    url: process.env.STRUCTURAL_SECTION_PROPERTIES_CALC_TOOL_URL,
  });
}

export function parseValue(bodyText: string, pattern: RegExp): number {
  const match = bodyText.match(pattern);
  if (!match) {
    throw new Error(
      `Could not parse section properties calculator value for pattern: ${pattern}`,
    );
  }

  return Number(match[1].replaceAll(",", ""));
}
