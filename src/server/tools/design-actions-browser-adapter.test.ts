import { afterEach, describe, expect, it } from "vitest";

import {
  DesignActionsBrowserAdapter,
  getDesignActionsBrowserAdapterFromEnv,
} from "@/server/tools/design-actions-browser-adapter";

describe("DesignActionsBrowserAdapter", () => {
  afterEach(() => {
    delete process.env.STRUCTURAL_ENABLE_DESIGN_ACTIONS_BROWSER_TOOL;
    delete process.env.STRUCTURAL_DESIGN_ACTIONS_BROWSER_TOOL_URL;
  });

  it("returns undefined when the browser tool is disabled", () => {
    expect(getDesignActionsBrowserAdapterFromEnv()).toBeUndefined();
  });

  it("creates the browser adapter when enabled", () => {
    process.env.STRUCTURAL_ENABLE_DESIGN_ACTIONS_BROWSER_TOOL = "true";
    process.env.STRUCTURAL_DESIGN_ACTIONS_BROWSER_TOOL_URL =
      "https://designactionspremium.netlify.app/";

    expect(getDesignActionsBrowserAdapterFromEnv()).toBeInstanceOf(
      DesignActionsBrowserAdapter,
    );
  });
});
