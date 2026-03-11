import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { listProtocolRuns } from "@/lib/protocol/protocolRuns";

const listProtocolRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  let logUserId: string | null = null;
  try {
    const demoMode = isDemoModeRequest(request);
    const session = await auth();
    const userId = demoMode ? LIVE_DEMO_USER_ID : session?.user?.id;
    logUserId = userId ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (demoMode) {
      await ensureLiveDemoData();
    }

    const { searchParams } = new URL(request.url);
    const payload = listProtocolRunsQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
    });
    const runs = await listProtocolRuns(userId, payload.limit ?? 20);
    return NextResponse.json({ ok: true, data: runs }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.protocol.runs.GET",
      message: error instanceof Error ? error.message : "Failed to list protocol runs.",
      userId: logUserId,
      path: "/api/protocol/runs",
      meta: { method: "GET" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
