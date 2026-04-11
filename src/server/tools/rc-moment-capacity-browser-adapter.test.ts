import { afterEach, describe, expect, it } from "vitest";

import {
  getRcMomentCapacityBrowserAdapterFromEnv,
  RcMomentCapacityBrowserAdapter,
} from "@/server/tools/rc-moment-capacity-browser-adapter";

describe("RcMomentCapacityBrowserAdapter", () => {
  afterEach(() => {
    delete process.env.STRUCTURAL_ENABLE_RC_MOMENT_BROWSER_TOOL;
    delete process.env.STRUCTURAL_RC_MOMENT_TOOL_URL;
  });

  it("returns undefined when the browser tool is not enabled", () => {
    const adapter = getRcMomentCapacityBrowserAdapterFromEnv();

    expect(adapter).toBeUndefined();
  });

  it("creates the browser adapter when enabled", () => {
    process.env.STRUCTURAL_ENABLE_RC_MOMENT_BROWSER_TOOL = "true";
    process.env.STRUCTURAL_RC_MOMENT_TOOL_URL =
      "https://rcmomentcapacity.netlify.app/";

    const adapter = getRcMomentCapacityBrowserAdapterFromEnv();

    expect(adapter).toBeInstanceOf(RcMomentCapacityBrowserAdapter);
  });
});
