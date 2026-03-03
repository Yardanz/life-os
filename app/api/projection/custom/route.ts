import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { projectionCustomPayloadSchema } from "@/lib/api/schemas";
import { toUtcDateOnly } from "@/lib/api/date";
import { ensureUserWithPlan, isPro } from "@/lib/api/plan";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { prisma } from "@/lib/prisma";
import { buildCalibrationProfile } from "@/lib/calibration/personalCalibration";
import { buildWeightConfig } from "@/lib/services/recalculateDay";
import type { PreviousBioStateInput, PreviousSnapshotInput } from "@/lib/scoring/types";
import { simulateForward30d, type ProjectionAvgInputs } from "@/lib/projection/simulateForward30d";
import { recordEvent } from "@/lib/telemetry";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value.toString());
}

function parseCheckinMetrics(notes: string | null): {
  sleepHours?: number;
  sleepQuality?: number;
  bedtimeMinutes?: number;
  wakeTimeMinutes?: number;
  workout?: number;
  deepWorkMin?: number;
  learningMin?: number;
  moneyDelta?: number;
} {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      sleepHours: typeof parsed.sleepHours === "number" ? parsed.sleepHours : undefined,
      sleepQuality: typeof parsed.sleepQuality === "number" ? parsed.sleepQuality : undefined,
      bedtimeMinutes: typeof parsed.bedtimeMinutes === "number" ? parsed.bedtimeMinutes : undefined,
      wakeTimeMinutes: typeof parsed.wakeTimeMinutes === "number" ? parsed.wakeTimeMinutes : undefined,
      workout: typeof parsed.workout === "number" ? parsed.workout : undefined,
      deepWorkMin: typeof parsed.deepWorkMin === "number" ? parsed.deepWorkMin : undefined,
      learningMin: typeof parsed.learningMin === "number" ? parsed.learningMin : undefined,
      moneyDelta: typeof parsed.moneyDelta === "number" ? parsed.moneyDelta : undefined,
    };
  } catch {
    return {};
  }
}

function toProjectionAvgInputs(
  checkins: Array<{
    stressLevel: number | null;
    notes: string | null;
  }>,
  fallbackBio: {
    sleepRegularity: number;
    cognitiveSaturation: number;
  }
): ProjectionAvgInputs {
  if (checkins.length === 0) {
    return {
      sleepHours: 7,
      sleepQuality: 3.5,
      bedtimeMinutes: 23 * 60 + 30,
      wakeTimeMinutes: 7 * 60 + 30,
      deepWorkMinutes: 60,
      learningMinutes: 20,
      stressLevel: 5,
      workoutRate: 0.25,
      moneyDelta: 0,
      sleepRegularity: fallbackBio.sleepRegularity,
      cognitiveSaturation: fallbackBio.cognitiveSaturation,
    };
  }

  const sum = checkins.reduce(
    (acc, item) => {
      const parsed = parseCheckinMetrics(item.notes);
      acc.sleepHours += parsed.sleepHours ?? 0;
      acc.sleepQuality += parsed.sleepQuality ?? 0;
      acc.bedtimeMinutes += parsed.bedtimeMinutes ?? 23 * 60 + 30;
      acc.wakeTimeMinutes += parsed.wakeTimeMinutes ?? 7 * 60 + 30;
      acc.deepWorkMin += parsed.deepWorkMin ?? 0;
      acc.learningMin += parsed.learningMin ?? 0;
      acc.moneyDelta += parsed.moneyDelta ?? 0;
      acc.stress += clamp(item.stressLevel ?? 5, 1, 10);
      acc.workouts += parsed.workout && parsed.workout > 0 ? 1 : 0;
      return acc;
    },
    {
      sleepHours: 0,
      sleepQuality: 0,
      bedtimeMinutes: 0,
      wakeTimeMinutes: 0,
      deepWorkMin: 0,
      learningMin: 0,
      moneyDelta: 0,
      stress: 0,
      workouts: 0,
    }
  );

  const n = checkins.length;
  const deepWorkAvg = sum.deepWorkMin / n;
  return {
    sleepHours: sum.sleepHours / n,
    sleepQuality: sum.sleepQuality / n,
    bedtimeMinutes: sum.bedtimeMinutes / n,
    wakeTimeMinutes: sum.wakeTimeMinutes / n,
    deepWorkMinutes: deepWorkAvg,
    learningMinutes: sum.learningMin / n,
    stressLevel: sum.stress / n,
    workoutRate: clamp(sum.workouts / n, 0, 1),
    moneyDelta: sum.moneyDelta / n,
    sleepRegularity: fallbackBio.sleepRegularity,
    cognitiveSaturation: clamp((deepWorkAvg * 3 * 100) / 360, 0, 100),
  };
}

function defaultBioState(date: Date): PreviousBioStateInput {
  return {
    date,
    energyReserve: 50,
    cognitiveFatigue: 30,
    strainIndex: 0,
    overloadLevel: 0,
    recoveryDebt: 0,
    adaptiveCapacity: 50,
    sleepBuffer: 0,
    circadianAlignment: 70,
    sleepRegularity: 70,
    stressLoad: 20,
    trainingBuffer: 0,
    homeostasisBias: 20,
    cognitiveSaturation: 0,
    sympatheticDrive: 40,
    parasympatheticDrive: 40,
    autonomicBalance: 50,
    hormeticSignal: 20,
    overstressSignal: 10,
    burnoutRiskIndex: 15,
    resilienceIndex: 50,
  };
}

export async function POST(request: Request) {
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

    const rawPayload = (await request.json()) as Record<string, unknown>;
    const payload = projectionCustomPayloadSchema.parse({
      ...rawPayload,
      userId: sessionUserId,
    });
    const user = await ensureUserWithPlan(sessionUserId, request);
    if (!isPro(user)) {
      return NextResponse.json(
        {
          ok: true,
          data: { custom: null, deltasAt30d: null },
        },
        { status: 200 }
      );
    }

    const date = toUtcDateOnly(payload.date);

    const initialStatRows = await prisma.statSnapshot.findMany({
      where: { userId: user.id, date: { lte: date } },
      orderBy: { date: "desc" },
      take: 2,
      select: {
        date: true,
        health: true,
        relationships: true,
        career: true,
        finance: true,
        personalGrowth: true,
        lifeScore: true,
        configVersion: true,
      },
    });
    const initialStat = initialStatRows[0];
    if (!initialStat) throw new ApiError(404, "Snapshot not found for projection.");
    const startDate = initialStat.date;

    const initialBioRows = await prisma.bioStateSnapshot.findMany({
      where: { userId: user.id, date: { lte: startDate } },
      orderBy: { date: "desc" },
      take: 2,
      select: {
        date: true,
        energyReserve: true,
        cognitiveFatigue: true,
        strainIndex: true,
        overloadLevel: true,
        recoveryDebt: true,
        adaptiveCapacity: true,
        sleepBuffer: true,
        circadianAlignment: true,
        sleepRegularity: true,
        stressLoad: true,
        trainingBuffer: true,
        homeostasisBias: true,
        cognitiveSaturation: true,
        sympatheticDrive: true,
        parasympatheticDrive: true,
        autonomicBalance: true,
        hormeticSignal: true,
        overstressSignal: true,
        burnoutRiskIndex: true,
        resilienceIndex: true,
      },
    });

    const currentBio = initialBioRows[0]
      ? ({
          date: initialBioRows[0].date,
          energyReserve: initialBioRows[0].energyReserve,
          cognitiveFatigue: initialBioRows[0].cognitiveFatigue,
          strainIndex: initialBioRows[0].strainIndex,
          overloadLevel: clamp(initialBioRows[0].overloadLevel, 0, 2) as 0 | 1 | 2,
          recoveryDebt: initialBioRows[0].recoveryDebt,
          adaptiveCapacity: initialBioRows[0].adaptiveCapacity,
          sleepBuffer: initialBioRows[0].sleepBuffer,
          circadianAlignment: initialBioRows[0].circadianAlignment,
          sleepRegularity: initialBioRows[0].sleepRegularity,
          stressLoad: initialBioRows[0].stressLoad,
          trainingBuffer: initialBioRows[0].trainingBuffer,
          homeostasisBias: initialBioRows[0].homeostasisBias,
          cognitiveSaturation: initialBioRows[0].cognitiveSaturation,
          sympatheticDrive: initialBioRows[0].sympatheticDrive,
          parasympatheticDrive: initialBioRows[0].parasympatheticDrive,
          autonomicBalance: initialBioRows[0].autonomicBalance,
          hormeticSignal: initialBioRows[0].hormeticSignal,
          overstressSignal: initialBioRows[0].overstressSignal,
          burnoutRiskIndex: initialBioRows[0].burnoutRiskIndex,
          resilienceIndex: initialBioRows[0].resilienceIndex,
        } satisfies PreviousBioStateInput)
      : defaultBioState(startDate);

    const previousBio = initialBioRows[1]
      ? ({
          date: initialBioRows[1].date,
          energyReserve: initialBioRows[1].energyReserve,
          cognitiveFatigue: initialBioRows[1].cognitiveFatigue,
          strainIndex: initialBioRows[1].strainIndex,
          overloadLevel: clamp(initialBioRows[1].overloadLevel, 0, 2) as 0 | 1 | 2,
          recoveryDebt: initialBioRows[1].recoveryDebt,
          adaptiveCapacity: initialBioRows[1].adaptiveCapacity,
          sleepBuffer: initialBioRows[1].sleepBuffer,
          circadianAlignment: initialBioRows[1].circadianAlignment,
          sleepRegularity: initialBioRows[1].sleepRegularity,
          stressLoad: initialBioRows[1].stressLoad,
          trainingBuffer: initialBioRows[1].trainingBuffer,
          homeostasisBias: initialBioRows[1].homeostasisBias,
          cognitiveSaturation: initialBioRows[1].cognitiveSaturation,
          sympatheticDrive: initialBioRows[1].sympatheticDrive,
          parasympatheticDrive: initialBioRows[1].parasympatheticDrive,
          autonomicBalance: initialBioRows[1].autonomicBalance,
          hormeticSignal: initialBioRows[1].hormeticSignal,
          overstressSignal: initialBioRows[1].overstressSignal,
          burnoutRiskIndex: initialBioRows[1].burnoutRiskIndex,
          resilienceIndex: initialBioRows[1].resilienceIndex,
        } satisfies PreviousBioStateInput)
      : undefined;

    const previousSnapshot = initialStatRows[1]
      ? ({
          date: initialStatRows[1].date,
          lifeScore: toNumber(initialStatRows[1].lifeScore),
          stats: {
            Energy: toNumber(initialStatRows[1].health),
            Focus: toNumber(initialStatRows[1].relationships),
            Discipline: toNumber(initialStatRows[1].career),
            Finance: toNumber(initialStatRows[1].finance),
            Growth: toNumber(initialStatRows[1].personalGrowth),
          },
        } satisfies PreviousSnapshotInput)
      : undefined;

    const configRow = await prisma.weightConfig.findUnique({
      where: { configVersion: initialStat.configVersion },
      select: {
        configVersion: true,
        lagDays: true,
        decayDays: true,
        momentumWeight: true,
        healthWeight: true,
        relationWeight: true,
        careerWeight: true,
        reserveSleepGain: true,
        reserveWorkCost: true,
        reserveStressCost: true,
        fatigueCarry: true,
        fatigueWorkGain: true,
        fatigueStressGain: true,
        fatigueSleepRecovery: true,
        strainCarry: true,
        strainFatigueWeight: true,
        overloadLevel1Threshold: true,
        overloadLevel2Threshold: true,
        overloadRecoverThreshold: true,
        baseFocus: true,
        focusFromEnergy: true,
        focusFromFatigue: true,
        focusFromStress: true,
        optLoadMin: true,
        optLoadMax: true,
        adaptGain: true,
        burnoutPenalty: true,
        disciplineCarry: true,
        debtCarry: true,
        debtRecoveryFactor: true,
        adaptiveCarry: true,
        bufferGain: true,
        bufferCarry: true,
        bufferSpendMax: true,
        reserveFromBuffer: true,
        fatigueFromBuffer: true,
        stressCarry: true,
        stressGain: true,
        stressRecovery: true,
        trainingIn: true,
        trainingCarry: true,
        trainingSpendMax: true,
        trainingReserveBonus: true,
        trainingDisciplineBonus: true,
        trainingAdaptiveBonus: true,
        workoutSameDayCostReserve: true,
        workoutSameDayCostFatigue: true,
        sympCarry: true,
        paraCarry: true,
        sympFromStress: true,
        sympFromLoad: true,
        sympFromStrain: true,
        paraFromSleep: true,
        paraFromRecovery: true,
        paraFromCircadian: true,
        paraSuppressedByStressLoad: true,
      },
    });
    if (!configRow) throw new ApiError(404, "WeightConfig not found.");

    const checkins7d = await prisma.dailyCheckIn.findMany({
      where: { userId: user.id, date: { lte: startDate } },
      orderBy: { date: "desc" },
      take: 7,
      select: { stressLevel: true, notes: true },
    });

    const avgInputs = toProjectionAvgInputs(checkins7d, {
      sleepRegularity: currentBio.sleepRegularity,
      cognitiveSaturation: currentBio.cognitiveSaturation,
    });

    const modifiedInputs: ProjectionAvgInputs = {
      ...avgInputs,
      sleepHours: clamp(
        avgInputs.sleepHours +
          clamp(payload.modifiers.sleepMinutesDelta, payload.modifiers.workoutForcedOff ? 0 : -60, payload.modifiers.workoutForcedOff ? 60 : 120) / 60,
        4.5,
        9.5
      ),
      deepWorkMinutes: clamp(
        avgInputs.deepWorkMinutes *
          (1 +
            clamp(
              payload.modifiers.deepWorkPctDelta,
              payload.modifiers.workoutForcedOff ? -0.3 : -0.5,
              payload.modifiers.workoutForcedOff ? 0 : 0.3
            )),
        0,
        360
      ),
      stressLevel: clamp(
        avgInputs.stressLevel +
          clamp(payload.modifiers.stressDelta, payload.modifiers.workoutForcedOff ? -3 : -3, payload.modifiers.workoutForcedOff ? -1 : 3),
        1,
        10
      ),
      workoutRate: payload.modifiers.workoutForcedOff ? 0 : avgInputs.workoutRate,
    };

    const initialSnapshot: PreviousSnapshotInput = {
      date: initialStat.date,
      lifeScore: toNumber(initialStat.lifeScore),
      stats: {
        Energy: toNumber(initialStat.health),
        Focus: toNumber(initialStat.relationships),
        Discipline: toNumber(initialStat.career),
        Finance: toNumber(initialStat.finance),
        Growth: toNumber(initialStat.personalGrowth),
      },
    };

    const lifeScoreHistory = await prisma.statSnapshot.findMany({
      where: { userId: user.id, date: { lte: startDate } },
      orderBy: { date: "desc" },
      take: 7,
      select: { lifeScore: true },
    });
    const previousLifeScores = lifeScoreHistory.map((row) => toNumber(row.lifeScore)).reverse();
    const config = buildWeightConfig(configRow);
    const calibration = await buildCalibrationProfile({
      userId: user.id,
      endDate: startDate,
      windowDays: 30,
    });

    const baseline = simulateForward30d({
      userId: user.id,
      startDate,
      initialBioState: currentBio,
      initialStatsSnapshot: initialSnapshot,
      avgInputs,
      scenario: "BASELINE",
      config,
      previousSnapshot,
      previousBioState: previousBio,
      previousLifeScores,
      calibration,
      seedSalt: "baseline",
    });

    const customSeed = `${payload.modifiers.sleepMinutesDelta}:${payload.modifiers.deepWorkPctDelta}:${payload.modifiers.stressDelta}`;
    const custom = simulateForward30d({
      userId: user.id,
      startDate,
      initialBioState: currentBio,
      initialStatsSnapshot: initialSnapshot,
      avgInputs: modifiedInputs,
      scenario: "BASELINE",
      config,
      previousSnapshot,
      previousBioState: previousBio,
      previousLifeScores,
      calibration,
      seedSalt: customSeed,
    });
    recordEvent("scenario_compare");

    const baselineLast = baseline.days[baseline.days.length - 1];
    const customLast = custom.days[custom.days.length - 1];
    const deltasAt30d =
      baselineLast && customLast
        ? {
            lifeScore: Math.round((customLast.lifeScore - baselineLast.lifeScore) * 10) / 10,
            risk: Math.round((customLast.risk - baselineLast.risk) * 10) / 10,
            burnout: Math.round((customLast.burnoutRisk - baselineLast.burnoutRisk) * 10) / 10,
          }
        : { lifeScore: 0, risk: 0, burnout: 0 };

    return NextResponse.json(
      {
        ok: true,
        data: {
          custom: custom.days,
          deltasAt30d,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
