import { afterEach, describe, expect, it } from "vitest";

import {
  getRcShearCapacityBrowserAdapterFromEnv,
  RcShearCapacityBrowserAdapter,
} from "@/server/tools/rc-shear-capacity-browser-adapter";

describe("RcShearCapacityBrowserAdapter", () => {
  afterEach(() => {
    delete process.env.STRUCTURAL_ENABLE_RC_SHEAR_BROWSER_TOOL;
    delete process.env.STRUCTURAL_RC_SHEAR_TOOL_URL;
  });

  it("returns undefined when the browser tool is disabled", () => {
    expect(getRcShearCapacityBrowserAdapterFromEnv()).toBeUndefined();
  });

  it("creates the browser adapter when enabled", () => {
    process.env.STRUCTURAL_ENABLE_RC_SHEAR_BROWSER_TOOL = "true";
    process.env.STRUCTURAL_RC_SHEAR_TOOL_URL =
      "https://concreteshearstrength.netlify.app/";

    expect(getRcShearCapacityBrowserAdapterFromEnv()).toBeInstanceOf(
      RcShearCapacityBrowserAdapter,
    );
  });
});
