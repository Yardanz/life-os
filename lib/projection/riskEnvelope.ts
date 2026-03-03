import { toUtcDateOnly } from "@/lib/api/date";
import { buildCalibrationProfile } from "@/lib/calibration/personalCalibration";
import { prisma } from "@/lib/prisma";
import { simulateForward30d, type ProjectionAvgInputs } from "@/lib/projection/simulateForward30d";
import type { PreviousBioStateInput, PreviousSnapshotInput } from "@/lib/scoring/types";
import { buildWeightConfig } from "@/lib/services/recalculateDay";

export const SAFE_THRESHOLD = 65;
export const CAUTION_THRESHOLD = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value: number | { toString(): string }): number {
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

export type RiskEnvelopePoint = {
  tLabel: string;
  riskStabilize: number;
  riskBaseline: number;
  riskOverload: number;
};

export type RiskEnvelopeContext = {
  userId: string;
  startDate: Date;
  currentBio: PreviousBioStateInput;
  previousBio?: PreviousBioStateInput;
  previousSnapshot?: PreviousSnapshotInput;
  initialStatsSnapshot: PreviousSnapshotInput;
  config: ReturnType<typeof buildWeightConfig>;
  calibration: Awaited<ReturnType<typeof buildCalibrationProfile>>;
  baseAvgInputs: ProjectionAvgInputs;
  baselineWorkoutRate: number;
  previousLifeScores: number[];
  currentRiskSeed: number | undefined;
};

export async function prepareRiskEnvelopeContext(params: {
  userId: string;
  endDateISO: string;
  currentRisk?: number;
}): Promise<RiskEnvelopeContext | null> {
  const endDate = toUtcDateOnly(params.endDateISO);

  const initialStatRows = await prisma.statSnapshot.findMany({
    where: {
      userId: params.userId,
      date: { lte: endDate },
    },
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
  if (!initialStat) return null;
  const startDate = initialStat.date;

  const [initialBioRows, projectionConfigRow, checkins7d, lifeScoreHistory] = await Promise.all([
    prisma.bioStateSnapshot.findMany({
      where: { userId: params.userId, date: { lte: startDate } },
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
    }),
    prisma.weightConfig.findUnique({
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
    }),
    prisma.dailyCheckIn.findMany({
      where: {
        userId: params.userId,
        date: { lte: startDate },
      },
      orderBy: { date: "desc" },
      take: 7,
      select: {
        stressLevel: true,
        notes: true,
      },
    }),
    prisma.statSnapshot.findMany({
      where: { userId: params.userId, date: { lte: startDate } },
      orderBy: { date: "desc" },
      take: 7,
      select: { lifeScore: true },
    }),
  ]);
  if (!projectionConfigRow) return null;

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

  const baseAvgInputs = toProjectionAvgInputs(checkins7d, {
    sleepRegularity: currentBio.sleepRegularity,
    cognitiveSaturation: currentBio.cognitiveSaturation,
  });
  const recentWorkoutRaw = parseCheckinMetrics(checkins7d[0]?.notes ?? null).workout;
  const baselineWorkoutRate =
    typeof recentWorkoutRaw === "number"
      ? clamp(recentWorkoutRaw, 0, 1) >= 0.5
        ? 1
        : 0
      : baseAvgInputs.workoutRate >= 0.5
        ? 1
        : 0;

  const config = buildWeightConfig(projectionConfigRow);
  const calibration = await buildCalibrationProfile({
    userId: params.userId,
    endDate: startDate,
    windowDays: 30,
  });
  const initialStatsSnapshot: PreviousSnapshotInput = {
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
  return {
    userId: params.userId,
    startDate,
    currentBio,
    previousBio,
    previousSnapshot,
    initialStatsSnapshot,
    config,
    calibration,
    baseAvgInputs,
    baselineWorkoutRate,
    previousLifeScores: lifeScoreHistory.map((row) => toNumber(row.lifeScore)).reverse(),
    currentRiskSeed:
      typeof params.currentRisk === "number" ? clamp(params.currentRisk, 0, 100) : undefined,
  };
}

export function buildRiskEnvelopeScenarioInputs(
  baseAvgInputs: ProjectionAvgInputs,
  baselineWorkoutRate: number
): {
  baselineInputs: ProjectionAvgInputs;
  stabilizeInputs: ProjectionAvgInputs;
  overloadInputs: ProjectionAvgInputs;
} {
  const baselineInputs: ProjectionAvgInputs = {
    ...baseAvgInputs,
    workoutRate: baselineWorkoutRate,
  };
  const stabilizeInputs: ProjectionAvgInputs = {
    ...baseAvgInputs,
    sleepHours: clamp(baseAvgInputs.sleepHours + 1, 0, 9),
    deepWorkMinutes: clamp(baseAvgInputs.deepWorkMinutes * 0.6, 0, 360),
    stressLevel: clamp(baseAvgInputs.stressLevel - 2, 1, 10),
    workoutRate: 0,
  };
  const overloadInputs: ProjectionAvgInputs = {
    ...baseAvgInputs,
    sleepHours: clamp(baseAvgInputs.sleepHours - 1, 5, 12),
    deepWorkMinutes: clamp(baseAvgInputs.deepWorkMinutes * 1.3, 0, 360),
    stressLevel: clamp(baseAvgInputs.stressLevel + 2, 1, 10),
    workoutRate: 1,
  };
  return {
    baselineInputs,
    stabilizeInputs,
    overloadInputs,
  };
}

export function simulateRiskEnvelope72h(params: {
  context: RiskEnvelopeContext;
  avgInputs: ProjectionAvgInputs;
  seedSalt: string;
}): {
  riskByHour: number[];
  burnoutByHour: number[];
} {
  const simulation = simulateForward30d({
    userId: params.context.userId,
    startDate: params.context.startDate,
    step: "DAILY",
    inertiaStart: {
      risk: params.context.currentRiskSeed,
      burnoutRisk: clamp(params.context.currentBio.burnoutRiskIndex, 0, 100),
      strain: clamp(params.context.currentBio.strainIndex, 0, 100),
    },
    initialBioState: params.context.currentBio,
    initialStatsSnapshot: params.context.initialStatsSnapshot,
    avgInputs: params.avgInputs,
    scenario: "BASELINE",
    config: params.context.config,
    previousSnapshot: params.context.previousSnapshot,
    previousBioState: params.context.previousBio,
    previousLifeScores: params.context.previousLifeScores,
    calibration: params.context.calibration,
    seedSalt: params.seedSalt,
  });

  const riskStart = clamp(params.context.currentRiskSeed ?? simulation.days[0]?.risk ?? 0, 0, 100);
  const burnoutStart = clamp(params.context.currentBio.burnoutRiskIndex, 0, 100);
  const riskByHour = [riskStart];
  const burnoutByHour = [burnoutStart];
  for (let i = 0; i < 3; i += 1) {
    riskByHour.push(clamp(simulation.days[i]?.risk ?? riskByHour[riskByHour.length - 1], 0, 100));
    burnoutByHour.push(
      clamp(simulation.days[i]?.burnoutRisk ?? burnoutByHour[burnoutByHour.length - 1], 0, 100)
    );
  }

  return {
    riskByHour,
    burnoutByHour,
  };
}

export async function computeRiskEnvelope(params: {
  userId: string;
  endDateISO: string;
  currentRisk?: number;
}): Promise<RiskEnvelopePoint[]> {
  const context = await prepareRiskEnvelopeContext(params);
  if (!context) return [];

  const { baselineInputs, stabilizeInputs, overloadInputs } = buildRiskEnvelopeScenarioInputs(
    context.baseAvgInputs,
    context.baselineWorkoutRate
  );
  const currentRiskSeed =
    typeof params.currentRisk === "number" ? clamp(params.currentRisk, 0, 100) : undefined;
  const [baseline, stabilize, overload] = await Promise.all([
    Promise.resolve(
      simulateRiskEnvelope72h({
        context,
        avgInputs: baselineInputs,
        seedSalt: "env72h:baseline",
      })
    ),
    Promise.resolve(
      simulateRiskEnvelope72h({
        context,
        avgInputs: stabilizeInputs,
        seedSalt: "env72h:stabilize",
      })
    ),
    Promise.resolve(
      simulateRiskEnvelope72h({
        context,
        avgInputs: overloadInputs,
        seedSalt: "env72h:overload",
      })
    ),
  ]);

  const initialRisk = clamp(currentRiskSeed ?? baseline.riskByHour[0] ?? 0, 0, 100);
  const rows: RiskEnvelopePoint[] = [
    {
      tLabel: "0h",
      riskStabilize: initialRisk,
      riskBaseline: initialRisk,
      riskOverload: initialRisk,
    },
  ];
  for (let i = 0; i < 3; i += 1) {
    const riskBaseline = baseline.riskByHour[i + 1];
    const riskStabilize = stabilize.riskByHour[i + 1];
    const riskOverload = overload.riskByHour[i + 1];
    if (
      typeof riskBaseline !== "number" ||
      typeof riskStabilize !== "number" ||
      typeof riskOverload !== "number"
    ) {
      continue;
    }
    rows.push({
      tLabel: `${(i + 1) * 24}h`,
      riskStabilize,
      riskBaseline,
      riskOverload,
    });
  }

  return rows;
}

export function isWithinEnvelope(customProjectionRiskSeries: number[]): boolean {
  if (customProjectionRiskSeries.length === 0) return false;
  for (let i = 0; i < customProjectionRiskSeries.length; i += 1) {
    const risk = customProjectionRiskSeries[i];
    if (!Number.isFinite(risk)) return false;
    if (risk < 0 || risk > SAFE_THRESHOLD) return false;
  }
  return true;
}

export function createEnvelopeChecker(envelope: RiskEnvelopePoint[]) {
  void envelope;
  return (customProjectionRiskSeries: number[]) => isWithinEnvelope(customProjectionRiskSeries);
}
