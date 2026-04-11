import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRealDesignActionsAdapterFromEnv,
  RealDesignActionsAdapter,
} from "@/server/tools/real-design-actions-adapter";

describe("RealDesignActionsAdapter", () => {
  afterEach(() => {
    delete process.env.STRUCTURAL_DESIGN_ACTIONS_URL;
    delete process.env.STRUCTURAL_TOOL_API_KEY;
  });

  it("posts the normalized engineering payload to the configured endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ultimateMomentKnM: 20.83,
          ultimateShearKn: 25,
        }),
        { status: 200 },
      ),
    );

    const adapter = new RealDesignActionsAdapter({
      endpoint: "https://structural.example.com/design-actions",
      apiKey: "secret-token",
      fetchImpl,
    });

    const result = await adapter.calculate({
      spanMeters: 5,
      supportCondition: "fixed-fixed",
      appliedLoadKnPerM: 10,
    });

    expect(result.ultimateMomentKnM).toBe(20.83);
    expect(result.ultimateShearKn).toBe(25);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://structural.example.com/design-actions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer secret-token",
        }),
      }),
    );
  });

  it("reads the real integration configuration from environment variables", () => {
    process.env.STRUCTURAL_DESIGN_ACTIONS_URL =
      "https://structural.example.com/design-actions";
    process.env.STRUCTURAL_TOOL_API_KEY = "tool-key";

    const adapter = getRealDesignActionsAdapterFromEnv();

    expect(adapter).toBeInstanceOf(RealDesignActionsAdapter);
  });
});
