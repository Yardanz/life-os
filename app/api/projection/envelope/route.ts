import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { errorResponse } from "@/lib/api/errors";
import { controlRoomQuerySchema } from "@/lib/api/schemas";
import { formatDateOnly, todayUtcDateOnly, toUtcDateOnly } from "@/lib/api/date";
import { ensureUserWithPlan, isPro } from "@/lib/api/plan";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { computeRiskEnvelope, prepareRiskEnvelopeContext } from "@/lib/projection/riskEnvelope";
import { computeImpact } from "@/lib/projection/impactEngine";
import { computeDecisionBudget72h } from "@/lib/engine/decisionBudgetEngine";
import { computeConfidence } from "@/lib/confidence/confidenceEngine";
import { extractSeries } from "@/lib/patterns/patternDetection";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function GET(request: Request) {
  try {
    const demoMode = isDemoModeRequest(request);
    const session = await auth();
    const sessionUserId = demoMode ? LIVE_DEMO_USER_ID : session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (demoMode) {
      await ensureLiveDemoData();
    }

    const { searchParams } = new URL(request.url);
    const payload = controlRoomQuerySchema.parse({
      userId: sessionUserId,
      date: searchParams.get("date") ?? undefined,
    });

    const user = await ensureUserWithPlan(sessionUserId, request);
    const date = payload.date ? toUtcDateOnly(payload.date) : todayUtcDateOnly();
    const endDateISO = formatDateOnly(date);
    const currentRiskRaw = searchParams.get("currentRisk");
    const currentRisk =
      currentRiskRaw !== null && Number.isFinite(Number(currentRiskRaw))
        ? Number(currentRiskRaw)
        : undefined;

    if (!isPro(user)) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            envelope72h: null,
            impact72h: null,
            decisionBudget: null,
          },
        },
        { status: 200 }
      );
    }

    const envelope72h = await computeRiskEnvelope({
      userId: user.id,
      endDateISO,
      currentRisk,
    });
    const [stabilizeRisk, stabilizeBurnout, overloadRisk, overloadBurnout] = await Promise.all([
      computeImpact({
        userId: user.id,
        endDateISO,
        horizonHours: 72,
        mode: "stabilize",
        metric: "risk",
        currentRisk,
      }),
      computeImpact({
        userId: user.id,
        endDateISO,
        horizonHours: 72,
        mode: "stabilize",
        metric: "burnout",
        currentRisk,
      }),
      computeImpact({
        userId: user.id,
        endDateISO,
        horizonHours: 72,
        mode: "overload",
        metric: "risk",
        currentRisk,
      }),
      computeImpact({
        userId: user.id,
        endDateISO,
        horizonHours: 72,
        mode: "overload",
        metric: "burnout",
        currentRisk,
      }),
    ]);
    const [context, riskSeries14d, confidenceResult] = await Promise.all([
      prepareRiskEnvelopeContext({
        userId: user.id,
        endDateISO,
        currentRisk,
      }),
      extractSeries(user.id, endDateISO, 14),
      computeConfidence({
        userId: user.id,
        endDateISO,
      }).catch(() => ({
        confidence: 0.5,
      })),
    ]);
    const risk14Values = riskSeries14d
      .map((point) => point.risk)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const avgRisk14dRaw =
      risk14Values.length > 0 ? average(risk14Values) : clamp(currentRisk ?? envelope72h[0]?.riskBaseline ?? 0, 0, 100);
    const adaptiveRiskOffset = user.adaptiveRiskOffset ?? 0;
    const avgRisk14d = clamp(avgRisk14dRaw + adaptiveRiskOffset, 0, 100);
    const decisionBudget =
      context !== null
        ? computeDecisionBudget72h({
            context,
            avgRisk14d,
            confidence: clamp(confidenceResult.confidence, 0, 1),
            adaptiveRiskOffset,
          })
        : null;

    return NextResponse.json(
      {
        ok: true,
        data: {
          envelope72h,
          decisionBudget,
          impact72h: {
            stabilize: {
              risk: stabilizeRisk,
              burnout: stabilizeBurnout,
            },
            overload: {
              risk: overloadRisk,
              burnout: overloadBurnout,
            },
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
