import { z } from "zod";

export const supportConditionSchema = z.enum([
  "fixed-fixed",
  "simply-supported",
  "cantilever",
]);

export const materialFamilySchema = z.enum(["reinforced_concrete", "steel"]);

export const structuredEngineeringInputsSchema = z.object({
  spanMeters: z.number().positive().max(100).optional(),
  supportCondition: supportConditionSchema.optional(),
  appliedLoadKnPerM: z.number().positive().max(1000).optional(),
  materialFamily: materialFamilySchema.optional(),
});

export const copilotQuestionPayloadSchema = z.object({
  prompt: z.string().trim().min(10).max(2000),
  structuredInputs: structuredEngineeringInputsSchema.optional(),
});

export type CopilotQuestionPayloadInput = z.infer<
  typeof copilotQuestionPayloadSchema
>;
