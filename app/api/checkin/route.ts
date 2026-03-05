import { SystemStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkinPayloadSchema } from "@/lib/api/schemas";
import { formatDateOnly, toUtcDateOnly } from "@/lib/api/date";
import { ensureUserWithPlan } from "@/lib/api/plan";
import { requireWritableMode } from "@/lib/demoMode";
import { CHECKIN_LIMITS, normalizeCheckinCore } from "@/lib/checkinLimits";
import { clampTzOffsetMinutes, DEFAULT_TZ_OFFSET_MINUTES, getDayKeyAtOffset } from "@/lib/date/dayKey";
import { prisma } from "@/lib/prisma";
import { incrementCalibrationCheckins } from "@/lib/setup/userSetup";
import { recalculateDay } from "@/lib/services/recalculateDay";
import { deriveWakeFromBedtime } from "@/lib/date/timeMinutes";
import { recordEvent } from "@/lib/telemetry";

function resolveCheckinStatus(stress: number): SystemStatus {
  if (stress >= 9) return SystemStatus.CRITICAL;
  if (stress >= 7) return SystemStatus.WARNING;
  return SystemStatus.STABLE;
}

async function resolveConfigVersion(configVersion?: number): Promise<number> {
  if (configVersion) return configVersion;

  const activeConfig = await prisma.weightConfig.findFirst({
    where: { isActive: true },
    orderBy: [{ effectiveFrom: "desc" }, { configVersion: "desc" }],
    select: { configVersion: true },
  });

  if (!activeConfig) {
    throw new ApiError(400, "WeightConfig not found. Create active config first.");
  }

  return activeConfig.configVersion;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await ensureUserWithPlan(sessionUserId, request);
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const tzOffsetRaw = searchParams.get("tzOffsetMinutes");
    const tzOffsetMinutes = clampTzOffsetMinutes(
      tzOffsetRaw == null || tzOffsetRaw === "" ? DEFAULT_TZ_OFFSET_MINUTES : Number(tzOffsetRaw)
    );
    const date = dateParam
      ? toUtcDateOnly(dateParam)
      : toUtcDateOnly(getDayKeyAtOffset(new Date(), tzOffsetMinutes));

    const checkin = await prisma.dailyCheckIn.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date,
        },
      },
      select: {
        date: true,
        stressLevel: true,
        bedtimeMinutes: true,
        wakeTimeMinutes: true,
        notes: true,
      },
    });

    if (!checkin) {
      return NextResponse.json({ ok: true, data: null }, { status: 200 });
    }

    let notes: Record<string, unknown> = {};
    try {
      notes = checkin.notes ? (JSON.parse(checkin.notes) as Record<string, unknown>) : {};
    } catch {
      notes = {};
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          date: formatDateOnly(checkin.date),
          sleepHours: typeof notes.sleepHours === "number" ? notes.sleepHours : null,
          sleepQuality: typeof notes.sleepQuality === "number" ? notes.sleepQuality : null,
          bedtimeMinutes: checkin.bedtimeMinutes,
          wakeTimeMinutes: checkin.wakeTimeMinutes,
          workout: typeof notes.workout === "number" ? notes.workout : null,
          deepWorkMin: typeof notes.deepWorkMin === "number" ? notes.deepWorkMin : null,
          learningMin: typeof notes.learningMin === "number" ? notes.learningMin : null,
          moneyDelta: typeof notes.moneyDelta === "number" ? notes.moneyDelta : null,
          stress: checkin.stressLevel,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireWritableMode(request);
    const session = await auth();
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = (await request.json()) as Record<string, unknown>;
    const payload = checkinPayloadSchema.parse({
      ...rawBody,
      userId: sessionUserId,
    });
    const user = await ensureUserWithPlan(sessionUserId, request);
    const tzOffsetMinutes = clampTzOffsetMinutes(payload.tzOffsetMinutes ?? DEFAULT_TZ_OFFSET_MINUTES);
    const date = payload.date
      ? toUtcDateOnly(payload.date)
      : toUtcDateOnly(getDayKeyAtOffset(new Date(), tzOffsetMinutes));
    const configVersion = await resolveConfigVersion(payload.configVersion);
    const normalizedBase = normalizeCheckinCore({
      sleepHours: payload.sleepHours,
      sleepQuality: payload.sleepQuality,
      deepWorkMin: payload.deepWorkMin,
      learningMin: payload.learningMin,
      stress: payload.stress,
      workout: payload.workout,
      moneyDelta: payload.moneyDelta,
      bedtimeMinutes: payload.bedtimeMinutes ?? CHECKIN_LIMITS.bedtimeMinutes.defaultValue,
      wakeTimeMinutes: payload.wakeTimeMinutes ?? CHECKIN_LIMITS.wakeTimeMinutes.defaultValue,
    });
    const fallbackWake = deriveWakeFromBedtime(
      normalizedBase.values.bedtimeMinutes,
      normalizedBase.values.sleepHours
    );
    const normalized = normalizeCheckinCore({
      sleepHours: payload.sleepHours,
      sleepQuality: payload.sleepQuality,
      deepWorkMin: payload.deepWorkMin,
      learningMin: payload.learningMin,
      stress: payload.stress,
      workout: payload.workout,
      moneyDelta: payload.moneyDelta,
      bedtimeMinutes: normalizedBase.values.bedtimeMinutes,
      wakeTimeMinutes: payload.wakeTimeMinutes ?? fallbackWake,
    });
    const bedtimeMinutes = normalized.values.bedtimeMinutes;
    const wakeTimeMinutes = normalized.values.wakeTimeMinutes;

    const metrics = {
      sleepHours: normalized.values.sleepHours,
      sleepQuality: normalized.values.sleepQuality,
      bedtimeMinutes,
      wakeTimeMinutes,
      workout: normalized.values.workout ? 1 : 0,
      deepWorkMin: normalized.values.deepWorkMin,
      learningMin: normalized.values.learningMin,
      moneyDelta: normalized.values.moneyDelta,
      stress: normalized.values.stress,
      noteText: payload.notes ?? null,
    };

    await prisma.$transaction(async (tx) => {
      await tx.dailyCheckIn.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date,
          },
        },
        update: {
          mood: payload.mood,
          stressLevel: normalized.values.stress,
          energyLevel: payload.energyLevel,
          bedtimeMinutes,
          wakeTimeMinutes,
          notes: JSON.stringify(metrics),
          systemStatus: resolveCheckinStatus(normalized.values.stress),
          configVersion,
        },
        create: {
          userId: user.id,
          date,
          mood: payload.mood,
          stressLevel: normalized.values.stress,
          energyLevel: payload.energyLevel,
          bedtimeMinutes,
          wakeTimeMinutes,
          notes: JSON.stringify(metrics),
          systemStatus: resolveCheckinStatus(normalized.values.stress),
          configVersion,
        },
      });
    });

    const recalculated = await recalculateDay(user.id, date);
    let setupState: { confidence: number; confidencePct: number } | null = null;
    try {
      setupState = await incrementCalibrationCheckins(user.id);
    } catch {
      setupState = null;
    }
    recordEvent("checkin_saved");

    return NextResponse.json(
      {
        ok: true,
        message: "Check-in saved and day recalculated",
        data: {
          userId: user.id,
          date: formatDateOnly(date),
          snapshotId: recalculated.snapshotId,
          status: recalculated.status,
          lifeScore: recalculated.lifeScore,
          plan: user.plan,
          setupState,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
