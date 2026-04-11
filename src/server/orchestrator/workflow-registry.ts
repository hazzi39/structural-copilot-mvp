import type { WorkflowSummary } from "@/types/structural";

export const approvedWorkflows: WorkflowSummary[] = [
  {
    id: "rc_beam_design",
    name: "RC Beam Design",
    description:
      "Preliminary reinforced concrete beam sizing with moment and shear capacity checks.",
  },
  {
    id: "design_actions",
    name: "Design Actions",
    description:
      "Calculate structural design actions for approved span, support, and loading patterns.",
  },
  {
    id: "steel_section_search",
    name: "Steel Section Search",
    description:
      "Search approved steel alternatives for comparison against the RC option.",
  },
  {
    id: "timber_member_design",
    name: "Timber Member Design",
    description:
      "Assess timber bending, compression, and shear capacity using approved timber design tools.",
  },
  {
    id: "section_property_analysis",
    name: "Section Property Analysis",
    description:
      "Calculate approved cross-section area, centroid, and inertia properties for supported shapes.",
  },
];

export const orchestrationGuardrails = [
  "Reject prompts outside structural engineering before running tools.",
  "Only approved workflows can call internal tool adapters.",
  "Reasoning remains private behind the backend orchestrator.",
  "Responses are returned as structured engineering objects, not raw tool traces.",
];
