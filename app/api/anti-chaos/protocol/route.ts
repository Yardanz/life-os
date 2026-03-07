import { NextResponse } from "next/server";
import { antiChaosProtocolPayloadSchema } from "@/lib/api/schemas";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { requireProPlan } from "@/lib/api/plan";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { generateAntiChaosProtocol } from "@/lib/anti-chaos/antiChaos";
import { persistAntiChaosProtocol } from "@/lib/anti-chaos/persistAntiChaosProtocol";

export async function POST(request: Request) {
  try {
    const demoMode = isDemoModeRequest(request);
    if (demoMode) {
      await ensureLiveDemoData();
    }
    const payload = antiChaosProtocolPayloadSchema.parse(await request.json());
    const effectiveUserId = demoMode ? LIVE_DEMO_USER_ID : payload.userId;
    await requireProPlan(effectiveUserId, request);

    const protocol = await generateAntiChaosProtocol({
      userId: effectiveUserId,
      dateISO: payload.date,
      horizonHours: payload.horizonHours,
    });
    await persistAntiChaosProtocol(protocol);
    return NextResponse.json({ ok: true, data: protocol }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const demoMode = isDemoModeRequest(request);
    if (demoMode) {
      await ensureLiveDemoData();
    }
    const { searchParams } = new URL(request.url);
    const parsed = antiChaosProtocolPayloadSchema.parse({
      userId: searchParams.get("userId") ?? LIVE_DEMO_USER_ID,
      date: searchParams.get("date"),
      horizonHours: searchParams.get("horizonHours") ? Number(searchParams.get("horizonHours")) : 24,
    });
    const effectiveUserId = demoMode ? LIVE_DEMO_USER_ID : parsed.userId;
    await requireProPlan(effectiveUserId, request);

    const protocol = await generateAntiChaosProtocol({
      userId: effectiveUserId,
      dateISO: parsed.date,
      horizonHours: parsed.horizonHours,
    });
    await persistAntiChaosProtocol(protocol);
    return NextResponse.json({ ok: true, data: protocol }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return NextResponse.json({ ok: true, data: null }, { status: 200 });
    }
    return errorResponse(error);
  }
}
