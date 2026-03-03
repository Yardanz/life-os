import { NextResponse } from "next/server";
import { antiChaosPayloadSchema } from "@/lib/api/schemas";
import { todayUtcDateOnly, toUtcDateOnly } from "@/lib/api/date";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { ensureUserWithPlan, isPro, requireProPlan } from "@/lib/api/plan";
import { prisma } from "@/lib/prisma";
import {
  decodeAntiChaosActionItems,
  generateAntiChaosPlan,
  type AntiChaosDiagnosis,
} from "@/lib/anti-chaos/generateAntiChaosPlan";

function serializePlan(plan: {
  userId: string;
  date: Date;
  reasons: string[];
  actionItems: string[];
  systemStatus: string;
}) {
  const decoded = decodeAntiChaosActionItems(plan.actionItems);
  return {
    userId: plan.userId,
    date: plan.date.toISOString().slice(0, 10),
    diagnoses: plan.reasons as AntiChaosDiagnosis[],
    detected: plan.reasons.join(" / "),
    mainPriority: decoded.mainPriority,
    secondary: decoded.secondary,
    mandatoryRecovery: decoded.mandatoryRecovery,
    cutList: decoded.cutList,
    expectedEffects: decoded.expectedEffects,
    systemStatus: plan.systemStatus,
  };
}

export async function POST(request: Request) {
  try {
    const body = antiChaosPayloadSchema.parse(await request.json());
    const day = body.date ? toUtcDateOnly(body.date) : todayUtcDateOnly();
    const user = await requireProPlan(body.userId, request);
    const plan = await generateAntiChaosPlan(day, user.id);

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...plan,
          detected: plan.diagnoses.join(" / "),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = antiChaosPayloadSchema.parse({
      userId: searchParams.get("userId") ?? "demo-user",
      date: searchParams.get("date") ?? undefined,
    });
    const user = await ensureUserWithPlan(parsed.userId, request);
    if (!isPro(user)) {
      throw new ApiError(403, "Operator capability required.", {
        code: "OPERATOR_REQUIRED",
        message: "Pay for Operator License to access Anti-Chaos protocol.",
      });
    }
    const day = parsed.date ? toUtcDateOnly(parsed.date) : todayUtcDateOnly();

    const plan = await prisma.antiChaosPlan.findUnique({
      where: { userId_date: { userId: user.id, date: day } },
      select: {
        userId: true,
        date: true,
        reasons: true,
        actionItems: true,
        systemStatus: true,
      },
    });

    if (!plan) {
      throw new ApiError(404, "Anti-Chaos plan not found for requested date.");
    }

    return NextResponse.json({ ok: true, data: serializePlan(plan) }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
