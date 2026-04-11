import { describe, expect, it } from "vitest";

import { StubPrivateReasoningService } from "@/server/reasoning/private-reasoning-service";
import { StructuralCopilotService } from "@/server/orchestrator/structural-copilot-service";
import { MockStructuralToolAdapters } from "@/server/tools/tool-adapters";

describe("StructuralCopilotService", () => {
  const service = new StructuralCopilotService();

  it("rejects out-of-scope prompts before orchestration", async () => {
    const result = await service.handleRequest({
      prompt: "Write a JavaScript shopping list app for my holiday plans.",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.response.code).toBe("OUT_OF_SCOPE");
  });

  it("runs the RC beam workflow for an in-scope prompt", async () => {
    const result = await service.handleRequest({
      prompt:
        "Find an optimal section size and reinforcement for a reinforced concrete beam. The section must span 5 metres and is fixed at both ends supporting a 10 kN/m applied load. Check moment capacity and shear capacity. Provide an alternative steel section.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.response.workflowId).toBe("rc_beam_design");
    expect(result.response.keyOutputs.length).toBeGreaterThan(3);
    expect(result.response.designOutputs.length).toBeGreaterThan(0);
    expect(result.response.comparisonTables.length).toBeGreaterThan(0);
    expect(
      result.response.designOutputs.some(
        (group) => group.title === "Selected RC design",
      ),
    ).toBe(true);
    expect(
      result.response.comparisonTables.some(
        (table) => table.title === "RC candidate comparison",
      ),
    ).toBe(true);
    expect(result.response.alternatives.length).toBeGreaterThan(0);
  });

  it("uses material strengths parsed from the prompt and reports ligature assumptions", async () => {
    const result = await service.handleRequest({
      prompt:
        "Design a reinforced concrete beam with 40 MPa concrete and 500 MPa reinforcement. The beam spans 5 metres, is fixed at both ends, carries 10 kN/m, and requires moment and shear capacity checks.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(
      result.response.keyOutputs.some(
        (item) => item.label === "Concrete strength" && item.value === "40",
      ),
    ).toBe(true);
    expect(
      result.response.keyOutputs.some((item) => item.label === "Assumed ligatures"),
    ).toBe(true);
  });

  it("honors user-requested bar and ligature arrangements from the prompt", async () => {
    const result = await service.handleRequest({
      prompt:
        "Design a reinforced concrete beam using 2N20 bars as reinforcement and N12 ligatures at 150 mm centres. The beam spans 5 metres, is fixed at both ends, carries 10 kN/m, and requires moment and shear capacity checks.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(
      result.response.keyOutputs.some(
        (item) =>
          item.label === "Recommended reinforcement" && item.value === "2N20",
      ),
    ).toBe(true);
    expect(
      result.response.keyOutputs.some(
        (item) =>
          item.label === "Assumed ligatures" &&
          item.value.includes("N12") &&
          item.value.includes("150 mm"),
      ),
    ).toBe(true);
  });

  it("locks a user-requested section size into the workflow", async () => {
    const result = await service.handleRequest({
      prompt:
        "Design a reinforced concrete beam using a 300 x 500 mm section, 2N20 bars as reinforcement, and N12 ligatures at 150 mm centres. The beam spans 5 metres, is fixed at both ends, carries 10 kN/m, and requires moment and shear capacity checks.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(
      result.response.parsedInputs.some(
        (item) =>
          item.label === "Requested section size" &&
          item.value === "300 x 500 mm",
      ),
    ).toBe(true);
    expect(
      result.response.keyOutputs.some(
        (item) =>
          item.label === "Recommended section" &&
          item.value === "300 x 500",
      ),
    ).toBe(true);
  });

  it("honors cover, stirrup legs, and reinforcement layer preferences from the prompt", async () => {
    const result = await service.handleRequest({
      prompt:
        "Design a reinforced concrete beam using a 300 x 500 mm section, 2N20 bars in 2 layers, 50 mm cover, and 4N12 ligatures at 125 mm centres. The beam spans 5 metres, is fixed at both ends, carries 10 kN/m, and requires moment and shear capacity checks.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(
      result.response.parsedInputs.some(
        (item) =>
          item.label === "Requested concrete cover" && item.value === "50 mm",
      ),
    ).toBe(true);
    expect(
      result.response.parsedInputs.some(
        (item) =>
          item.label === "Requested main reinforcement" &&
          item.value.includes("2 layers"),
      ),
    ).toBe(true);
    expect(
      result.response.keyOutputs.some(
        (item) =>
          item.label === "Assumed ligatures" &&
          item.value.includes("4-leg N12") &&
          item.value.includes("125 mm"),
      ),
    ).toBe(true);
  });

  it("returns missing inputs when the structural prompt is incomplete", async () => {
    const result = await service.handleRequest({
      prompt:
        "Check moment and shear capacity for a reinforced concrete beam and recommend reinforcement.",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.response.code).toBe("MISSING_INPUTS");
    expect(result.response.details).toContain("spanMeters");
  });

  it("runs the section property workflow for approved geometry prompts", async () => {
    const sectionService = new StructuralCopilotService({
      tools: new MockStructuralToolAdapters(),
      reasoningService: new StubPrivateReasoningService(),
      sectionPropertyTool: {
        calculate: async () => ({
          areaMm2: 180000,
          centroidXMm: 0,
          centroidYMm: 0,
          yPositionMm: 300,
          ixxMm4: 5.4e9,
          iyyMm4: 1.35e9,
          ixyMm4: 0,
          polarMomentMm4: 6.75e9,
          principalI1Mm4: 5.4e9,
          principalI2Mm4: 1.35e9,
        }),
      },
    });

    const result = await sectionService.handleRequest({
      prompt:
        "Calculate section properties and second moment of area for a rectangular section 300 x 600 mm.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.response.workflowId).toBe("section_property_analysis");
    expect(
      result.response.keyOutputs.some(
        (item) => item.label === "Area" && item.unit === "mm^2",
      ),
    ).toBe(true);
    expect(
      result.response.designOutputs.some(
        (group) => group.title === "Primary section properties",
      ),
    ).toBe(true);
    expect(result.response.comparisonTables).toEqual([]);
    expect(
      result.response.parsedInputs.some(
        (item) => item.label === "Width" && item.value === "300 mm",
      ),
    ).toBe(true);
  });
});
