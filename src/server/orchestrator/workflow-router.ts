import type { CopilotQuestionPayload, WorkflowId } from "@/types/structural";

export interface WorkflowRoutingDecision {
  workflowId?: WorkflowId;
  reason?: string;
}

export function routeWorkflow(
  payload: CopilotQuestionPayload,
): WorkflowRoutingDecision {
  const normalizedPrompt = payload.prompt.toLowerCase();

  const isRcBeamRequest =
    (normalizedPrompt.includes("reinforced concrete") ||
      normalizedPrompt.includes("rc")) &&
    (normalizedPrompt.includes("moment") ||
      normalizedPrompt.includes("shear") ||
      normalizedPrompt.includes("beam") ||
      normalizedPrompt.includes("section"));

  if (isRcBeamRequest) {
    return { workflowId: "rc_beam_design" };
  }

  const isTimberRequest =
    normalizedPrompt.includes("timber") &&
    (normalizedPrompt.includes("capacity") ||
      normalizedPrompt.includes("member") ||
      normalizedPrompt.includes("bending") ||
      normalizedPrompt.includes("shear"));

  if (isTimberRequest) {
    return { workflowId: "timber_member_design" };
  }

  const isSectionPropertyRequest =
    normalizedPrompt.includes("section properties") ||
    normalizedPrompt.includes("second moment") ||
    normalizedPrompt.includes("moment of inertia") ||
    normalizedPrompt.includes("centroid") ||
    normalizedPrompt.includes("polar moment") ||
    normalizedPrompt.includes("rectangular section") ||
    normalizedPrompt.includes("circular section") ||
    normalizedPrompt.includes("i-section") ||
    normalizedPrompt.includes("i section");

  if (isSectionPropertyRequest) {
    return { workflowId: "section_property_analysis" };
  }

  if (normalizedPrompt.includes("design actions")) {
    return { workflowId: "design_actions" };
  }

  if (normalizedPrompt.includes("steel section")) {
    return { workflowId: "steel_section_search" };
  }

  return {
    reason:
      "Prompt is structural but does not match an approved MVP workflow yet.",
  };
}
