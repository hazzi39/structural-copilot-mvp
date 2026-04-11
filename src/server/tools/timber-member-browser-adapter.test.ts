import { afterEach, describe, expect, it } from "vitest";

import {
  getTimberMemberBrowserAdapterFromEnv,
  TimberMemberBrowserAdapter,
} from "@/server/tools/timber-member-browser-adapter";

describe("TimberMemberBrowserAdapter", () => {
  afterEach(() => {
    delete process.env.STRUCTURAL_ENABLE_TIMBER_BROWSER_TOOL;
    delete process.env.STRUCTURAL_TIMBER_TOOL_URL;
  });

  it("returns undefined when disabled", () => {
    expect(getTimberMemberBrowserAdapterFromEnv()).toBeUndefined();
  });

  it("creates the adapter when enabled", () => {
    process.env.STRUCTURAL_ENABLE_TIMBER_BROWSER_TOOL = "true";
    process.env.STRUCTURAL_TIMBER_TOOL_URL =
      "https://timbercapacityprem.netlify.app/";

    expect(getTimberMemberBrowserAdapterFromEnv()).toBeInstanceOf(
      TimberMemberBrowserAdapter,
    );
  });
});
