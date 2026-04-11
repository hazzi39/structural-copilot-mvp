import { z } from "zod";

import type {
  DesignActionsInput,
  DesignActionsResult,
} from "@/server/tools/tool-adapters";

const designActionsResponseSchema = z.object({
  ultimateMomentKnM: z.number().finite(),
  ultimateShearKn: z.number().finite(),
});

export interface RealDesignActionsAdapterOptions {
  endpoint: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class RealDesignActionsAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: RealDesignActionsAdapterOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async calculate(input: DesignActionsInput): Promise<DesignActionsResult> {
    const response = await this.fetchImpl(this.options.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.options.apiKey
          ? { Authorization: `Bearer ${this.options.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        workflow: "design_actions",
        units: {
          span: "m",
          lineLoad: "kN/m",
          moment: "kN.m",
          shear: "kN",
        },
        input,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `Design actions tool request failed with status ${response.status}.`,
      );
    }

    const payload = await response.json();
    return designActionsResponseSchema.parse(payload);
  }
}

export function getRealDesignActionsAdapterFromEnv():
  | RealDesignActionsAdapter
  | undefined {
  const endpoint = process.env.STRUCTURAL_DESIGN_ACTIONS_URL;

  if (!endpoint) {
    return undefined;
  }

  return new RealDesignActionsAdapter({
    endpoint,
    apiKey: process.env.STRUCTURAL_TOOL_API_KEY,
  });
}
