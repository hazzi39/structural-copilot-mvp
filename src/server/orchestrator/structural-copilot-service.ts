import type {
  CopilotQuestionPayload,
  StructuralCopilotErrorResponse,
  StructuralCopilotResponse,
} from "@/types/structural";
import { copilotQuestionPayloadSchema } from "@/server/domain/copilot-contracts";
import { evaluateStructuralScope } from "@/server/domain/domain-guard";
import {
  extractRcBeamRequest,
  findMissingRcBeamInputs,
} from "@/server/domain/input-extraction";
import {
  extractTimberRequest,
  findMissingTimberInputs,
} from "@/server/domain/timber-input-extraction";
import {
  extractSectionPropertyRequest,
  findMissingSectionPropertyInputs,
} from "@/server/domain/section-property-input-extraction";
import {
  StubPrivateReasoningService,
  type PrivateReasoningService,
} from "@/server/reasoning/private-reasoning-service";
import type {
  AdvancedSectionPropertyBrowserAdapter,
  AdvancedSectionPropertyInput,
} from "@/server/tools/advanced-section-property-browser-adapter";
import type { SectionPropertiesCalcBrowserAdapter } from "@/server/tools/section-properties-calc-browser-adapter";
import type {
  TimberMemberBrowserAdapter,
  TimberMemberCapacityInput,
} from "@/server/tools/timber-member-browser-adapter";
import {
  MockStructuralToolAdapters,
  type StructuralToolAdapters,
} from "@/server/tools/tool-adapters";
import {
  createAdvancedSectionPropertyAdapterFromRegistry,
  createDesignActionsAdapterFromRegistry,
  createRcMomentCapacityAdapterFromRegistry,
  createRcShearCapacityAdapterFromRegistry,
  createSectionPropertiesCalcAdapterFromRegistry,
  createTimberMemberAdapterFromRegistry,
} from "@/server/tools/tool-registry";
import { runRcBeamWorkflow } from "@/server/orchestrator/rc-beam-workflow";
import { runSectionPropertyWorkflow } from "@/server/orchestrator/section-property-workflow";
import { runTimberMemberWorkflow } from "@/server/orchestrator/timber-member-workflow";
import { routeWorkflow } from "@/server/orchestrator/workflow-router";

export interface StructuralCopilotServiceDependencies {
  tools: StructuralToolAdapters;
  reasoningService: PrivateReasoningService;
  timberTool?: Pick<TimberMemberBrowserAdapter, "calculate">;
  sectionPropertyTool?: Pick<AdvancedSectionPropertyBrowserAdapter, "calculate">;
  secondarySectionPropertyTool?: Pick<SectionPropertiesCalcBrowserAdapter, "calculate">;
}

export type StructuralCopilotServiceResult =
  | { ok: true; response: StructuralCopilotResponse }
  | { ok: false; response: StructuralCopilotErrorResponse; status: number };

export class StructuralCopilotService {
  constructor(
    private readonly dependencies: StructuralCopilotServiceDependencies = {
      tools: new MockStructuralToolAdapters(
        createDesignActionsAdapterFromRegistry(),
        createRcMomentCapacityAdapterFromRegistry(),
        createRcShearCapacityAdapterFromRegistry(),
      ),
      timberTool: createTimberMemberAdapterFromRegistry(),
      sectionPropertyTool: createAdvancedSectionPropertyAdapterFromRegistry(),
      secondarySectionPropertyTool: createSectionPropertiesCalcAdapterFromRegistry(),
      reasoningService: new StubPrivateReasoningService(),
    },
  ) {}

  async handleRequest(
    payload: CopilotQuestionPayload,
  ): Promise<StructuralCopilotServiceResult> {
    const validation = copilotQuestionPayloadSchema.safeParse(payload);

    if (!validation.success) {
      return {
        ok: false,
        status: 400,
        response: {
          error: "Request payload failed validation.",
          code: "INVALID_REQUEST",
          details: validation.error.issues.map((issue) => issue.message),
        },
      };
    }

    const scopeResult = evaluateStructuralScope(validation.data.prompt);
    if (!scopeResult.allowed) {
      return {
        ok: false,
        status: 422,
        response: {
          error: scopeResult.reason ?? "Prompt is out of scope.",
          code: "OUT_OF_SCOPE",
          details: scopeResult.matchedSignals,
        },
      };
    }

    const routingDecision = routeWorkflow(validation.data);
    if (!routingDecision.workflowId) {
      return {
        ok: false,
        status: 422,
        response: {
          error: routingDecision.reason ?? "No approved workflow matched the request.",
          code: "UNSUPPORTED_WORKFLOW",
        },
      };
    }

    if (routingDecision.workflowId !== "rc_beam_design") {
      if (routingDecision.workflowId === "timber_member_design") {
        if (!this.dependencies.timberTool) {
          return {
            ok: false,
            status: 422,
            response: {
              error:
                "The timber workflow is approved but the timber browser tool is not enabled in this environment.",
              code: "UNSUPPORTED_WORKFLOW",
            },
          };
        }

        const timberRequest = extractTimberRequest(validation.data);
        const missingTimberInputs = findMissingTimberInputs(timberRequest);

        if (missingTimberInputs.length > 0) {
          return {
            ok: false,
            status: 422,
            response: {
              error:
                "The prompt is in scope, but required timber inputs are missing for the timber member workflow.",
              code: "MISSING_INPUTS",
              details: missingTimberInputs,
            },
          };
        }

        const response = await runTimberMemberWorkflow({
          request: timberRequest as TimberMemberCapacityInput,
          timberTool: this.dependencies.timberTool,
          reasoningService: this.dependencies.reasoningService,
        });

        return {
          ok: true,
          response,
        };
      }

      if (routingDecision.workflowId === "section_property_analysis") {
        if (!this.dependencies.sectionPropertyTool) {
          return {
            ok: false,
            status: 422,
            response: {
              error:
                "The section property workflow is approved but the advanced section property browser tool is not enabled in this environment.",
              code: "UNSUPPORTED_WORKFLOW",
            },
          };
        }

        const sectionPropertyRequest = extractSectionPropertyRequest(
          validation.data,
        );
        const missingSectionPropertyInputs = findMissingSectionPropertyInputs(
          sectionPropertyRequest,
        );

        if (missingSectionPropertyInputs.length > 0) {
          return {
            ok: false,
            status: 422,
            response: {
              error:
                "The prompt is in scope, but required geometry inputs are missing for the section property workflow.",
              code: "MISSING_INPUTS",
              details: missingSectionPropertyInputs,
            },
          };
        }

        const response = await runSectionPropertyWorkflow({
          request: sectionPropertyRequest as AdvancedSectionPropertyInput,
          sectionTool: this.dependencies.sectionPropertyTool,
          secondarySectionTool: this.dependencies.secondarySectionPropertyTool,
          reasoningService: this.dependencies.reasoningService,
        });

        return {
          ok: true,
          response,
        };
      }

      return {
        ok: false,
        status: 422,
        response: {
          error:
            "This structural request matched a future workflow, but only the RC beam, timber member, and section property flows are enabled right now.",
          code: "UNSUPPORTED_WORKFLOW",
        },
      };
    }

    const request = extractRcBeamRequest(validation.data);
    const missingInputs = findMissingRcBeamInputs(request);

    if (missingInputs.length > 0) {
      return {
        ok: false,
        status: 422,
        response: {
          error:
            "The prompt is in scope, but required engineering inputs are missing for the RC beam workflow.",
          code: "MISSING_INPUTS",
          details: missingInputs,
        },
      };
    }

    const response = await runRcBeamWorkflow({
      request: {
        spanMeters: request.spanMeters!,
        appliedLoadKnPerM: request.appliedLoadKnPerM!,
        supportCondition: request.supportCondition!,
        materialFamily: request.materialFamily,
        concreteStrengthMpa: request.concreteStrengthMpa,
        steelYieldStrengthMpa: request.steelYieldStrengthMpa,
        requestedCoverMm: request.requestedCoverMm,
        requestedWidthMm: request.requestedWidthMm,
        requestedDepthMm: request.requestedDepthMm,
        requestedRebarCount: request.requestedRebarCount,
        requestedRebarDiameterMm: request.requestedRebarDiameterMm,
        requestedRebarLayerCount: request.requestedRebarLayerCount,
        requestedStirrupDiameterMm: request.requestedStirrupDiameterMm,
        requestedStirrupLegCount: request.requestedStirrupLegCount,
        requestedStirrupSpacingMm: request.requestedStirrupSpacingMm,
        requiresMomentCheck: request.requiresMomentCheck,
        requiresShearCheck: request.requiresShearCheck,
        requiresSteelAlternative: request.requiresSteelAlternative,
      },
      tools: this.dependencies.tools,
      reasoningService: this.dependencies.reasoningService,
    });

    return {
      ok: true,
      response,
    };
  }
}
