import { NextRequest, NextResponse } from "next/server";

import { StructuralCopilotService } from "@/server/orchestrator/structural-copilot-service";

const structuralCopilotService = new StructuralCopilotService();

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const result = await structuralCopilotService.handleRequest(payload);

    if (!result.ok) {
      return NextResponse.json(result.response, { status: result.status });
    }

    return NextResponse.json(result.response, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: "Unexpected server error while handling the structural copilot request.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
