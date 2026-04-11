export type WorkflowId =
  | "rc_beam_design"
  | "design_actions"
  | "steel_section_search"
  | "timber_member_design"
  | "section_property_analysis";

export type SupportCondition = "fixed-fixed" | "simply-supported" | "cantilever";

export type MaterialFamily = "reinforced_concrete" | "steel";

export interface StructuredEngineeringInputs {
  spanMeters?: number;
  supportCondition?: SupportCondition;
  appliedLoadKnPerM?: number;
  materialFamily?: MaterialFamily;
}

export interface CopilotQuestionPayload {
  prompt: string;
  structuredInputs?: StructuredEngineeringInputs;
}

export interface WorkflowSummary {
  id: WorkflowId;
  name: string;
  description: string;
}

export interface ResultSection<T> {
  title: string;
  items: T[];
}

export interface KeyOutput {
  label: string;
  value: string;
  unit?: string;
}

export interface ResultRow {
  label: string;
  value: string;
  unit?: string;
}

export interface ComparisonColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

export interface ComparisonRow {
  id: string;
  values: Record<string, string>;
  status?: "selected" | "feasible" | "governing";
}

export interface ComparisonTable {
  title: string;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
}

export interface VisualisationDatum {
  x: string;
  y: number;
  label?: string;
}

export interface ParsedInput {
  label: string;
  value: string;
}

export interface StructuralCopilotResponse {
  workflowId: WorkflowId;
  summary: string;
  parsedInputs: ParsedInput[];
  assumptions: string[];
  keyOutputs: KeyOutput[];
  designOutputs: ResultSection<ResultRow>[];
  comparisonTables: ComparisonTable[];
  recommendedOption: string;
  alternatives: string[];
  commentary: string[];
  warnings: string[];
  engineerReviewDisclaimer: string;
  visualisations: ResultSection<VisualisationDatum>;
}

export interface StructuralCopilotErrorResponse {
  error: string;
  code:
    | "OUT_OF_SCOPE"
    | "UNSUPPORTED_WORKFLOW"
    | "MISSING_INPUTS"
    | "INVALID_REQUEST"
    | "INTERNAL_ERROR";
  details?: string[];
}
