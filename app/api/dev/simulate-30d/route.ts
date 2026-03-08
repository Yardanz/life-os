import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { isAdmin } from "@/lib/authz";
import { devSimulate30dPayloadSchema } from "@/lib/api/schemas";
import { ensureUserWithPlan } from "@/lib/api/plan";
import { prisma } from "@/lib/prisma";
import {
  buildBurnoutSpiralCheckins,
  buildRecoveryReboundCheckins,
  buildSimulatedCheckins,
} from "@/lib/dev/simulateCheckins";
import { recalculateDay } from "@/lib/services/recalculateDay";
import { toUtcDateOnly } from "@/lib/api/date";
import { getUtcISODate } from "@/lib/date/getUtcISODate";

function devToolsEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEV_TOOLS === "true";
}

async function resolveConfigVersion(): Promise<number> {
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

export async function POST(request: Request) {
  try {
    if (!devToolsEnabled()) throw new ApiError(404, "Not found");
    const session = await auth();
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      throw new ApiError(401, "Unauthorized");
    }

    const payload = devSimulate30dPayloadSchema.parse(await request.json());
    const sessionUser = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true, email: true, role: true },
    });
    const admin = isAdmin(sessionUser);
    const targetUserId = payload.userId;
    if (!admin && targetUserId !== sessionUserId) {
      throw new ApiError(403, "Dev simulation is allowed only for the current user.");
    }

    const user = await ensureUserWithPlan(targetUserId, request);
    const endDate = toUtcDateOnly(payload.endDateISO);
    const days = payload.days ?? 30;
    const startDate = new Date(endDate);
    startDate.setUTCDate(endDate.getUTCDate() - (days - 1));

    if (payload.mode === "clear") {
      await prisma.$transaction(async (tx) => {
        await tx.statContribution.deleteMany({
          where: {
            userId: user.id,
            date: { gte: startDate, lte: endDate },
          },
        });
        await tx.bioStateSnapshot.deleteMany({
          where: {
            userId: user.id,
            date: { gte: startDate, lte: endDate },
          },
        });
        await tx.statSnapshot.deleteMany({
          where: {
            userId: user.id,
            date: { gte: startDate, lte: endDate },
          },
        });
        await tx.dailyCheckIn.deleteMany({
          where: {
            userId: user.id,
            date: { gte: startDate, lte: endDate },
          },
        });
      });

      return NextResponse.json(
        {
          ok: true,
          data: {
            mode: "clear",
            userId: user.id,
            startDate: startDate.toISOString().slice(0, 10),
            endDate: payload.endDateISO,
            deletedDays: days,
          },
        },
        { status: 200 }
      );
    }

    const seed = payload.seed === undefined || payload.seed === "" ? getUtcISODate() : payload.seed;
    const configVersion = await resolveConfigVersion();
    let generated;
    if (payload.scenario === "burnout_spiral") {
      generated = buildBurnoutSpiralCheckins({
        userId: user.id,
        endDateISO: payload.endDateISO,
        days,
        seed,
      });
    } else if (payload.scenario === "recovery_rebound") {
      generated = buildRecoveryReboundCheckins({
        userId: user.id,
        endDateISO: payload.endDateISO,
        days,
        seed,
      });
    } else {
      generated = buildSimulatedCheckins({
        userId: user.id,
        endDateISO: payload.endDateISO,
        days,
        seed,
      });
    }

    const existing = payload.overwrite
      ? new Set<string>()
      : new Set(
          (
            await prisma.dailyCheckIn.findMany({
              where: { userId: user.id, date: { gte: startDate, lte: endDate } },
              select: { date: true },
            })
          ).map((row) => row.date.toISOString().slice(0, 10))
        );

    for (const row of generated) {
      const dateKey = row.date.toISOString().slice(0, 10);
      if (!payload.overwrite && existing.has(dateKey)) continue;

      await prisma.dailyCheckIn.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: row.date,
          },
        },
        update: {
          mood: row.mood,
          stressLevel: row.stressLevel,
          energyLevel: row.energyLevel,
          bedtimeMinutes: row.notePayload.bedtimeMinutes,
          wakeTimeMinutes: row.notePayload.wakeTimeMinutes,
          notes: JSON.stringify(row.notePayload),
          systemStatus: row.systemStatus,
          configVersion,
        },
        create: {
          userId: user.id,
          date: row.date,
          mood: row.mood,
          stressLevel: row.stressLevel,
          energyLevel: row.energyLevel,
          bedtimeMinutes: row.notePayload.bedtimeMinutes,
          wakeTimeMinutes: row.notePayload.wakeTimeMinutes,
          notes: JSON.stringify(row.notePayload),
          systemStatus: row.systemStatus,
          configVersion,
        },
      });
    }

    for (const row of generated) {
      await recalculateDay(user.id, row.date);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          mode: "simulate",
          userId: user.id,
          startDate: startDate.toISOString().slice(0, 10),
          endDate: payload.endDateISO,
          days,
          seed: String(seed),
          overwrite: payload.overwrite,
          scenario: payload.scenario,
          generatedCount: generated.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
