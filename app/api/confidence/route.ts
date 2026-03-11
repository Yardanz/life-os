import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { errorResponse } from "@/lib/api/errors";
import { confidenceQuerySchema } from "@/lib/api/schemas";
import { formatDateOnly, todayUtcDateOnly, toUtcDateOnly } from "@/lib/api/date";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { ensureUserWithPlan } from "@/lib/api/plan";
import { computeConfidence } from "@/lib/confidence/confidenceEngine";

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
    const payload = confidenceQuerySchema.parse({
      userId: effectiveUserId,
      date: searchParams.get("date") ?? undefined,
    });

    const user = await ensureUserWithPlan(payload.userId, request, { allowCreate: false });
    const date = payload.date ? toUtcDateOnly(payload.date) : todayUtcDateOnly();
    const endDateISO = formatDateOnly(date);

    const confidence = await computeConfidence({
      userId: user.id,
      endDateISO,
    });

    return NextResponse.json(
      {
        ok: true,
        data: confidence,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
