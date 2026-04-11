import type { Page } from "playwright";

export type AdvancedSectionShape = "rectangular" | "circular" | "i_section";

export interface AdvancedSectionPropertyInput {
  shapeType: AdvancedSectionShape;
  widthMm?: number;
  heightMm?: number;
  radiusMm?: number;
  flangeWidthMm?: number;
  flangeThicknessMm?: number;
  webHeightMm?: number;
  webThicknessMm?: number;
}

export interface AdvancedSectionPropertyResult {
  areaMm2: number;
  centroidXMm: number;
  centroidYMm: number;
  yPositionMm: number;
  ixxMm4: number;
  iyyMm4: number;
  ixyMm4: number;
  polarMomentMm4: number;
  principalI1Mm4: number;
  principalI2Mm4: number;
}

export interface AdvancedSectionPropertyBrowserAdapterOptions {
  url?: string;
  timeoutMs?: number;
}

export class AdvancedSectionPropertyBrowserAdapter {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(options: AdvancedSectionPropertyBrowserAdapterOptions = {}) {
    this.url = options.url ?? "https://advancedsectionproperty.netlify.app/";
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async calculate(
    input: AdvancedSectionPropertyInput,
  ): Promise<AdvancedSectionPropertyResult> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(this.timeoutMs);

      await page.goto(this.url, { waitUntil: "networkidle" });

      await selectShape(page, input.shapeType);
      await fillShapeInputs(page, input);
      await page.waitForTimeout(800);

      const bodyText = await page.locator("body").innerText();

      return {
        areaMm2: parseLabeledValue(bodyText, /Cross-sectional Area:[\s\S]*?([\d.+\-eE]+)\s*mm²/i),
        centroidXMm: parseLabeledValue(bodyText, /Centroid X-coordinate:[\s\S]*?([\d.+\-eE]+)\s*mm/i),
        centroidYMm: parseLabeledValue(bodyText, /Centroid Y-coordinate:[\s\S]*?([\d.+\-eE]+)\s*mm/i),
        yPositionMm: parseLabeledValue(bodyText, /y-Position:[\s\S]*?([\d.+\-eE]+)\s*mm/i),
        ixxMm4: parseLabeledValue(bodyText, /Second Moment of Area \(X-axis\):[\s\S]*?([\d.+\-eE]+)\s*mm⁴/i),
        iyyMm4: parseLabeledValue(bodyText, /Second Moment of Area \(Y-axis\):[\s\S]*?([\d.+\-eE]+)\s*mm⁴/i),
        ixyMm4: parseLabeledValue(bodyText, /Product of Inertia:[\s\S]*?([\d.+\-eE]+)\s*mm⁴/i),
        polarMomentMm4: parseLabeledValue(bodyText, /Polar Moment of Inertia:[\s\S]*?([\d.+\-eE]+)\s*mm⁴/i),
        principalI1Mm4: parseLabeledValue(bodyText, /Principal Moment I₁:[\s\S]*?([\d.+\-eE]+)\s*mm⁴/i),
        principalI2Mm4: parseLabeledValue(bodyText, /Principal Moment I₂:[\s\S]*?([\d.+\-eE]+)\s*mm⁴/i),
      };
    } finally {
      await browser.close();
    }
  }
}

async function selectShape(
  page: Page,
  shapeType: AdvancedSectionShape,
): Promise<void> {
  const buttonName =
    shapeType === "rectangular"
      ? /Rectangular Section/i
      : shapeType === "circular"
        ? /Circular Section/i
        : /I-Section/i;

  await page.getByRole("button", { name: buttonName }).click();
}

async function fillShapeInputs(
  page: Page,
  input: AdvancedSectionPropertyInput,
): Promise<void> {
  const fields =
    input.shapeType === "rectangular"
      ? [input.widthMm, input.heightMm]
      : input.shapeType === "circular"
        ? [input.radiusMm]
        : [
            input.flangeWidthMm,
            input.flangeThicknessMm,
            input.webHeightMm,
            input.webThicknessMm,
          ];

  const inputs = page.locator('input[type="number"]');
  for (let index = 0; index < fields.length; index += 1) {
    await inputs.nth(index).fill(String(fields[index] ?? ""));
  }
}

export function getAdvancedSectionPropertyBrowserAdapterFromEnv():
  | AdvancedSectionPropertyBrowserAdapter
  | undefined {
  if (
    process.env.STRUCTURAL_ENABLE_ADVANCED_SECTION_PROPERTY_BROWSER_TOOL !==
    "true"
  ) {
    return undefined;
  }

  return new AdvancedSectionPropertyBrowserAdapter({
    url: process.env.STRUCTURAL_ADVANCED_SECTION_PROPERTY_TOOL_URL,
  });
}

export function parseLabeledValue(bodyText: string, pattern: RegExp): number {
  const match = bodyText.match(pattern);
  if (!match) {
    throw new Error(
      `Could not parse advanced section property value for pattern: ${pattern}`,
    );
  }

  return Number(match[1].replaceAll(",", ""));
}
