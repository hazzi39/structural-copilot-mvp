export interface PrivateReasoningRequest {
  workflowId: string;
  objective: string;
  allowedCapabilities: string[];
}

export interface PrivateReasoningResult {
  narrative: string;
  assumptions: string[];
}

export interface PrivateReasoningService {
  summarize(request: PrivateReasoningRequest): Promise<PrivateReasoningResult>;
}

export class StubPrivateReasoningService implements PrivateReasoningService {
  async summarize(
    request: PrivateReasoningRequest,
  ): Promise<PrivateReasoningResult> {
    return {
      narrative: `Private reasoning placeholder for ${request.workflowId}: ${request.objective}`,
      assumptions: [
        "Reasoning access is private and can only be invoked by approved workflows.",
        `Allowed capabilities: ${request.allowedCapabilities.join(", ") || "none"}.`,
      ],
    };
  }
}
