import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { confidenceQuerySchema } from "@/lib/api/schemas";
import { formatDateOnly, todayUtcDateOnly, toUtcDateOnly } from "@/lib/api/date";
import { ensureUserWithPlan } from "@/lib/api/plan";
import { computeConfidence } from "@/lib/confidence/confidenceEngine";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = confidenceQuerySchema.parse({
      userId: searchParams.get("userId") ?? "",
      date: searchParams.get("date") ?? undefined,
    });

    const user = await ensureUserWithPlan(payload.userId, request);
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
