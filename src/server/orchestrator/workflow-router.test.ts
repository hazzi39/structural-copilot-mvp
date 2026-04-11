import { describe, expect, it } from "vitest";

import { routeWorkflow } from "@/server/orchestrator/workflow-router";

describe("routeWorkflow", () => {
  it("routes the MVP RC beam request to the RC beam workflow", () => {
    const result = routeWorkflow({
      prompt:
        "Find an optimal section size and reinforcement for a reinforced concrete section and check moment and shear capacity.",
    });

    expect(result.workflowId).toBe("rc_beam_design");
  });

  it("returns no workflow for unmatched structural prompts", () => {
    const result = routeWorkflow({
      prompt: "Review lateral drift implications for a multistorey frame.",
    });

    expect(result.workflowId).toBeUndefined();
  });

  it("routes timber member prompts to the timber workflow", () => {
    const result = routeWorkflow({
      prompt:
        "Check a timber member using F14 timber, 200 x 300 mm section, 3.2 m effective length, 8.5 kNm bending, and 15 kN shear.",
    });

    expect(result.workflowId).toBe("timber_member_design");
  });

  it("routes section property prompts to the section property workflow", () => {
    const result = routeWorkflow({
      prompt:
        "Calculate section properties and second moment of area for a rectangular section 300 x 600 mm.",
    });

    expect(result.workflowId).toBe("section_property_analysis");
  });
});
