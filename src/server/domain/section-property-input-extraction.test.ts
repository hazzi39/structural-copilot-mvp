import { describe, expect, it } from "vitest";

import {
  extractSectionPropertyRequest,
  findMissingSectionPropertyInputs,
} from "@/server/domain/section-property-input-extraction";

describe("extractSectionPropertyRequest", () => {
  it("extracts rectangular section dimensions", () => {
    const request = extractSectionPropertyRequest({
      prompt:
        "Calculate the section properties and second moments of area for a rectangular section 300 x 600 mm.",
    });

    expect(request).toMatchObject({
      shapeType: "rectangular",
      widthMm: 300,
      heightMm: 600,
    });
  });

  it("extracts circular sections from diameter wording", () => {
    const request = extractSectionPropertyRequest({
      prompt:
        "Find the centroid and moment of inertia for a circular section with diameter 450 mm.",
    });

    expect(request).toMatchObject({
      shapeType: "circular",
      radiusMm: 225,
    });
  });

  it("extracts I-section dimensions", () => {
    const request = extractSectionPropertyRequest({
      prompt:
        "Calculate section properties for an I-section with flange width 200 mm, flange thickness 20 mm, web height 360 mm, and web thickness 12 mm.",
    });

    expect(request).toMatchObject({
      shapeType: "i_section",
      flangeWidthMm: 200,
      flangeThicknessMm: 20,
      webHeightMm: 360,
      webThicknessMm: 12,
    });
  });
});

describe("findMissingSectionPropertyInputs", () => {
  it("returns missing geometry for incomplete requests", () => {
    expect(
      findMissingSectionPropertyInputs({ shapeType: "rectangular", widthMm: 300 }),
    ).toEqual(["heightMm"]);
  });
});
