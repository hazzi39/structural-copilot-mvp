import { describe, expect, it } from "vitest";

import {
  approvedWorkflows,
  orchestrationGuardrails,
} from "@/server/orchestrator/workflow-registry";

describe("workflowRegistry", () => {
  it("includes the MVP RC beam workflow", () => {
    expect(approvedWorkflows.some((workflow) => workflow.id === "rc_beam_design")).toBe(
      true,
    );
  });

  it("declares guardrails that prevent generic chatbot behavior", () => {
    expect(
      orchestrationGuardrails.some((guardrail) =>
        guardrail.includes("Reject prompts outside structural engineering"),
      ),
    ).toBe(true);
  });
});
