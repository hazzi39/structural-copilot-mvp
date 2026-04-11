import { describe, expect, it } from "vitest";

import { copilotQuestionPayloadSchema } from "@/server/domain/copilot-contracts";

describe("copilotQuestionPayloadSchema", () => {
  it("accepts a structural prompt with structured engineering inputs", () => {
    const result = copilotQuestionPayloadSchema.safeParse({
      prompt:
        "Check a reinforced concrete beam spanning 5 metres under a 10 kN/m load.",
      structuredInputs: {
        spanMeters: 5,
        supportCondition: "fixed-fixed",
        appliedLoadKnPerM: 10,
        materialFamily: "reinforced_concrete",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects obviously invalid spans", () => {
    const result = copilotQuestionPayloadSchema.safeParse({
      prompt:
        "Check a reinforced concrete beam spanning 5 metres under a 10 kN/m load.",
      structuredInputs: {
        spanMeters: -2,
      },
    });

    expect(result.success).toBe(false);
  });
});
