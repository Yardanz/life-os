import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { antiChaosProtocolPayloadSchema } from "@/lib/api/schemas";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { ensureUserWithPlan, isPro } from "@/lib/api/plan";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { generateAntiChaosProtocol } from "@/lib/anti-chaos/antiChaos";
import { persistAntiChaosProtocol } from "@/lib/anti-chaos/persistAntiChaosProtocol";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const demoMode = isDemoModeRequest(request);
    const effectiveUserId = demoMode ? LIVE_DEMO_USER_ID : sessionUserId;
    if (demoMode) {
      await ensureLiveDemoData();
    }
    const rawPayload = (await request.json()) as Record<string, unknown>;
    const payload = antiChaosProtocolPayloadSchema.parse({
      ...rawPayload,
      userId: effectiveUserId,
    });
    const user = await ensureUserWithPlan(effectiveUserId, request, { allowCreate: false });
    if (!isPro(user)) {
      throw new ApiError(403, "Operator capability required.", {
        code: "OPERATOR_REQUIRED",
        message: "Pay for Operator License to access this feature.",
      });
    }

    const protocol = await generateAntiChaosProtocol({
      userId: user.id,
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
    const session = await auth();
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const demoMode = isDemoModeRequest(request);
    const effectiveUserId = demoMode ? LIVE_DEMO_USER_ID : sessionUserId;
    const { searchParams } = new URL(request.url);
    const parsed = antiChaosProtocolPayloadSchema.parse({
      userId: effectiveUserId,
      date: searchParams.get("date"),
      horizonHours: searchParams.get("horizonHours") ? Number(searchParams.get("horizonHours")) : 24,
    });
    const user = await ensureUserWithPlan(parsed.userId, request, { allowCreate: false });
    if (!isPro(user)) {
      throw new ApiError(403, "Operator capability required.", {
        code: "OPERATOR_REQUIRED",
        message: "Pay for Operator License to access this feature.",
      });
    }

    const protocol = await generateAntiChaosProtocol({
      userId: user.id,
      dateISO: parsed.date,
      horizonHours: parsed.horizonHours,
    });
    return NextResponse.json({ ok: true, data: protocol }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return NextResponse.json({ ok: true, data: null }, { status: 200 });
    }
    return errorResponse(error);
  }
}
