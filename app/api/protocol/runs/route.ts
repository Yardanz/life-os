import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { listProtocolRuns } from "@/lib/protocol/protocolRuns";

const listProtocolRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  try {
    const demoMode = isDemoModeRequest(request);
    const session = await auth();
    const userId = demoMode ? LIVE_DEMO_USER_ID : session?.user?.id;
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
    const message = error instanceof Error ? error.message : "Failed to list protocol runs.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
