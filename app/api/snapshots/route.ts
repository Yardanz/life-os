import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError } from "@/lib/api/errors";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID, requireWritableMode } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { rateLimit } from "@/lib/rateLimit";
import { generateSystemSnapshot, listSystemSnapshots } from "@/lib/snapshots/systemSnapshots";

export const runtime = "nodejs";

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
    const limitRaw = Number(searchParams.get("limit") ?? 5);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 5;
    const rows = await listSystemSnapshots(userId, limit);
    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.snapshots.GET",
      message: error instanceof Error ? error.message : "Failed to load snapshots.",
      userId: logUserId,
      path: "/api/snapshots",
      meta: { method: "GET" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let logUserId: string | null = null;
  try {
    requireWritableMode(request);
    const session = await auth();
    const userId = session?.user?.id;
    logUserId = userId ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(`snapshot_generate:${userId}`, { windowMs: 60 * 60 * 1000, max: 5 });
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs ?? 0 }, { status: 429 });
    }

    const generated = await generateSystemSnapshot(userId);
    return NextResponse.json({ ok: true, url: generated.url, data: generated }, { status: 200 });
  } catch (error) {
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.snapshots.POST",
      message: error instanceof Error ? error.message : "Failed to generate snapshot.",
      userId: logUserId,
      path: "/api/snapshots",
      meta: { method: "POST" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
