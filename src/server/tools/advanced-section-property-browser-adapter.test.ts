import { describe, expect, it } from "vitest";

import { parseLabeledValue } from "@/server/tools/advanced-section-property-browser-adapter";

describe("parseLabeledValue", () => {
  it("parses scientific notation values from the tool output", () => {
    const bodyText =
      "Second Moment of Area (X-axis): 5.400e+9 mm⁴\nPolar Moment of Inertia: 6.750e+9 mm⁴";

    expect(
      parseLabeledValue(
        bodyText,
        /Second Moment of Area \(X-axis\):[\s\S]*?([\d.+\-eE]+)\s*mm⁴/i,
      ),
    ).toBe(5.4e9);
    expect(
      parseLabeledValue(
        bodyText,
        /Polar Moment of Inertia:[\s\S]*?([\d.+\-eE]+)\s*mm⁴/i,
      ),
    ).toBe(6.75e9);
  });
});
