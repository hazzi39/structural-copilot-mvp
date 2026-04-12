import { describe, expect, it } from "vitest";

import {
  getToolDefinition,
  structuralToolRegistry,
} from "@/server/tools/tool-registry";

describe("structuralToolRegistry", () => {
  it("contains the approved browser-backed RC workflow tools", () => {
    expect(structuralToolRegistry.some((tool) => tool.key === "design_actions_browser")).toBe(
      true,
    );
    expect(structuralToolRegistry.some((tool) => tool.key === "rc_moment_browser")).toBe(
      true,
    );
    expect(structuralToolRegistry.some((tool) => tool.key === "rc_shear_browser")).toBe(
      true,
    );
    expect(
      structuralToolRegistry.some((tool) => tool.key === "timber_member_browser"),
    ).toBe(true);
    expect(
      structuralToolRegistry.some(
        (tool) => tool.key === "advanced_section_property_browser",
      ),
    ).toBe(true);
    expect(
      structuralToolRegistry.some(
        (tool) => tool.key === "section_properties_calc_browser",
      ),
    ).toBe(true);
  });

  it("keeps browser tools on an explicit allowlist", () => {
    const rcMoment = getToolDefinition("rc_moment_browser");

    expect(rcMoment?.allowedOrigins).toContain(
      "https://rcmomentcapacity.netlify.app",
    );
  });

  it("includes the approved timber browser origin", () => {
    const timber = getToolDefinition("timber_member_browser");
    expect(timber?.allowedOrigins).toContain(
      "https://timbercapacityprem.netlify.app",
    );
  });

  it("includes the approved advanced section property browser origin", () => {
    const tool = getToolDefinition("advanced_section_property_browser");
    expect(tool?.allowedOrigins).toContain(
      "https://advancedsectionproperty.netlify.app",
    );
  });

  it("includes the approved section properties calc browser origin", () => {
    const tool = getToolDefinition("section_properties_calc_browser");
    expect(tool?.allowedOrigins).toContain(
      "https://sectionpropertiescalc.netlify.app",
    );
  });
});
