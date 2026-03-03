import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { patternsQuerySchema } from "@/lib/api/schemas";
import { todayUtcDateOnly, formatDateOnly, toUtcDateOnly } from "@/lib/api/date";
import { ensureUserWithPlan } from "@/lib/api/plan";
import { detectPatterns } from "@/lib/patterns/patternDetection";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = patternsQuerySchema.parse({
      userId: searchParams.get("userId") ?? "",
      date: searchParams.get("date") ?? undefined,
      windowDays: searchParams.get("windowDays") ?? undefined,
    });

    const user = await ensureUserWithPlan(payload.userId, request);
    const date = payload.date ? toUtcDateOnly(payload.date) : todayUtcDateOnly();
    const endDateISO = formatDateOnly(date);
    const result = await detectPatterns({
      userId: user.id,
      endDateISO,
      windowDays: payload.windowDays ?? 21,
    });

    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
