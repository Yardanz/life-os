import { formatDateOnly, toUtcDateOnly } from "@/lib/api/date";
import { buildCalibrationProfile } from "@/lib/calibration/personalCalibration";
import { detectPatterns } from "@/lib/patterns/patternDetection";
import { simulateForward30d, type ProjectionAvgInputs } from "@/lib/projection/simulateForward30d";
import { prisma } from "@/lib/prisma";
import type { PreviousBioStateInput, PreviousSnapshotInput } from "@/lib/scoring/types";
import { buildWeightConfig } from "@/lib/services/recalculateDay";

const WINDOW_DAYS = 30;
const MIN_MEANINGFUL_DAYS = 14;

type ConfidenceComponents = {
  coverageScore: number;
  completenessScore: number;
  stabilityScore: number;
  convergenceScore: number;
  patternScore: number;
  sensitivityScore: number;
  daysWithCheckin: number;
  meanDelta: number;
  calibrationDrift: number | null;
  projectionSpread: number;
  windowDays: number;
};

export type ModelConfidenceResult = {
  confidence: number;
  components: ConfidenceComponents;
  notes: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function toNumber(value: number | { toString(): string }): number {
  return typeof value === "number" ? value : Number(value.toString());
}

function parseCheckinMetrics(notes: string | null): {
  sleepHours?: number;
  sleepQuality?: number;
  bedtimeMinutes?: number;
  wakeTimeMinutes?: number;
  deepWorkMinutes?: number;
} {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    const deepWorkRaw =
      typeof parsed.deepWorkMin === "number"
        ? parsed.deepWorkMin
        : typeof parsed.deepWorkMinutes === "number"
          ? parsed.deepWorkMinutes
          : undefined;
    return {
      sleepHours: typeof parsed.sleepHours === "number" ? parsed.sleepHours : undefined,
      sleepQuality: typeof parsed.sleepQuality === "number" ? parsed.sleepQuality : undefined,
      bedtimeMinutes: typeof parsed.bedtimeMinutes === "number" ? parsed.bedtimeMinutes : undefined,
      wakeTimeMinutes: typeof parsed.wakeTimeMinutes === "number" ? parsed.wakeTimeMinutes : undefined,
      deepWorkMinutes: deepWorkRaw,
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
    bedtimeMinutes: number | null;
    wakeTimeMinutes: number | null;
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
      acc.bedtimeMinutes += item.bedtimeMinutes ?? parsed.bedtimeMinutes ?? 23 * 60 + 30;
      acc.wakeTimeMinutes += item.wakeTimeMinutes ?? parsed.wakeTimeMinutes ?? 7 * 60 + 30;
      acc.deepWorkMin += parsed.deepWorkMinutes ?? 0;
      acc.stress += clamp(item.stressLevel ?? 5, 1, 10);
      return acc;
    },
    {
      sleepHours: 0,
      sleepQuality: 0,
      bedtimeMinutes: 0,
      wakeTimeMinutes: 0,
      deepWorkMin: 0,
      stress: 0,
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
    learningMinutes: 20,
    stressLevel: sum.stress / n,
    workoutRate: 0.25,
    moneyDelta: 0,
    sleepRegularity: fallbackBio.sleepRegularity,
    cognitiveSaturation: clamp((deepWorkAvg * 3 * 100) / 360, 0, 100),
  };
}

async function computeSensitivityScore(params: { userId: string; endDate: Date }): Promise<{ score: number; spread: number }> {
  const initialStatRows = await prisma.statSnapshot.findMany({
    where: {
      userId: params.userId,
      date: { lte: params.endDate },
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
  if (!initialStat) {
    return { score: 0.5, spread: 0 };
  }

  const startDate = initialStat.date;
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
  if (!configRow) {
    return { score: 0.5, spread: 0 };
  }

  const [initialBioRows, checkins7d, lifeScoreHistory] = await Promise.all([
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
    prisma.dailyCheckIn.findMany({
      where: { userId: params.userId, date: { lte: startDate } },
      orderBy: { date: "desc" },
      take: 7,
      select: { stressLevel: true, notes: true, bedtimeMinutes: true, wakeTimeMinutes: true },
    }),
    prisma.statSnapshot.findMany({
      where: { userId: params.userId, date: { lte: startDate } },
      orderBy: { date: "desc" },
      take: 7,
      select: { lifeScore: true },
    }),
  ]);

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

  const avgInputs = toProjectionAvgInputs(checkins7d, {
    sleepRegularity: currentBio.sleepRegularity,
    cognitiveSaturation: currentBio.cognitiveSaturation,
  });
  const previousLifeScores = lifeScoreHistory.map((row) => toNumber(row.lifeScore)).reverse();
  const config = buildWeightConfig(configRow);
  const calibration = await buildCalibrationProfile({
    userId: params.userId,
    endDate: startDate,
    windowDays: WINDOW_DAYS,
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

  const baseline = simulateForward30d({
    userId: params.userId,
    startDate,
    initialBioState: currentBio,
    initialStatsSnapshot,
    avgInputs,
    scenario: "BASELINE",
    config,
    previousSnapshot,
    previousBioState: previousBio,
    previousLifeScores,
    calibration,
  });
  const stabilization = simulateForward30d({
    userId: params.userId,
    startDate,
    initialBioState: currentBio,
    initialStatsSnapshot,
    avgInputs,
    scenario: "STABILIZATION",
    config,
    previousSnapshot,
    previousBioState: previousBio,
    previousLifeScores,
    calibration,
  });
  const overload = simulateForward30d({
    userId: params.userId,
    startDate,
    initialBioState: currentBio,
    initialStatsSnapshot,
    avgInputs,
    scenario: "OVERLOAD",
    config,
    previousSnapshot,
    previousBioState: previousBio,
    previousLifeScores,
    calibration,
  });

  const riskBase = baseline.days[baseline.days.length - 1]?.risk;
  const riskStb = stabilization.days[stabilization.days.length - 1]?.risk;
  const riskOvr = overload.days[overload.days.length - 1]?.risk;
  const burnBase = baseline.days[baseline.days.length - 1]?.burnoutRisk;
  const burnStb = stabilization.days[stabilization.days.length - 1]?.burnoutRisk;
  const burnOvr = overload.days[overload.days.length - 1]?.burnoutRisk;

  if (
    typeof riskBase !== "number" ||
    typeof riskStb !== "number" ||
    typeof riskOvr !== "number" ||
    typeof burnBase !== "number" ||
    typeof burnStb !== "number" ||
    typeof burnOvr !== "number"
  ) {
    return { score: 0.5, spread: 0 };
  }

  const spread = mean([
    Math.abs(riskBase - riskStb),
    Math.abs(riskOvr - riskBase),
    Math.abs(burnBase - burnStb),
    Math.abs(burnOvr - burnBase),
  ]);

  let score = 1;
  if (spread < 8) {
    score = spread / 8;
  } else if (spread > 25) {
    score = 1 - clamp((spread - 25) / 25, 0, 1);
  }

  return {
    score: clamp(score, 0, 1),
    spread,
  };
}

export async function computeConfidence(params: {
  userId: string;
  endDateISO: string;
}): Promise<ModelConfidenceResult> {
  const endDate = toUtcDateOnly(params.endDateISO);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (WINDOW_DAYS - 1));
  const dates: string[] = [];
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(formatDateOnly(d));
  }

  const [checkins, statRows, calibrationNow, patterns] = await Promise.all([
    prisma.dailyCheckIn.findMany({
      where: {
        userId: params.userId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        stressLevel: true,
        bedtimeMinutes: true,
        wakeTimeMinutes: true,
        notes: true,
      },
    }),
    prisma.statSnapshot.findMany({
      where: {
        userId: params.userId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        lifeScore: true,
      },
    }),
    buildCalibrationProfile({
      userId: params.userId,
      endDate,
      windowDays: WINDOW_DAYS,
    }),
    detectPatterns({
      userId: params.userId,
      endDateISO: params.endDateISO,
      windowDays: WINDOW_DAYS,
    }),
  ]);

  const checkinMap = new Map<string, (typeof checkins)[number]>();
  for (const row of checkins) {
    checkinMap.set(formatDateOnly(row.date), row);
  }

  const daysWithCheckin = checkinMap.size;
  const coverageScore = clamp(daysWithCheckin / WINDOW_DAYS, 0, 1);

  const completenessByDay = dates.map((dateISO) => {
    const row = checkinMap.get(dateISO);
    if (!row) return 0;
    const parsed = parseCheckinMetrics(row.notes);
    const filled = [
      typeof parsed.sleepHours === "number",
      typeof parsed.sleepQuality === "number",
      typeof (row.bedtimeMinutes ?? parsed.bedtimeMinutes) === "number",
      typeof (row.wakeTimeMinutes ?? parsed.wakeTimeMinutes) === "number",
      typeof row.stressLevel === "number",
      typeof parsed.deepWorkMinutes === "number",
    ].filter(Boolean).length;
    return filled / 6;
  });
  const completenessScore = clamp(mean(completenessByDay), 0, 1);

  const lifeScores = statRows.map((row) => toNumber(row.lifeScore));
  const deltas: number[] = [];
  for (let i = 1; i < lifeScores.length; i += 1) {
    deltas.push(Math.abs(lifeScores[i] - lifeScores[i - 1]));
  }
  const meanDelta = mean(deltas);
  const stabilityScore = 1 - clamp((meanDelta - 3) / 10, 0, 1);

  const prevEndDate = new Date(endDate);
  prevEndDate.setUTCDate(prevEndDate.getUTCDate() - 7);
  const hasPreviousCalibrationWindow = prevEndDate.getTime() >= startDate.getTime();
  let calibrationDrift: number | null = null;
  let convergenceScore = 0.5;

  if (calibrationNow.calibrationActive && hasPreviousCalibrationWindow) {
    const calibrationPrev = await buildCalibrationProfile({
      userId: params.userId,
      endDate: prevEndDate,
      windowDays: WINDOW_DAYS,
    });
    if (calibrationPrev.daysAvailable >= MIN_MEANINGFUL_DAYS) {
      const nowVals = calibrationNow.multipliers;
      const prevVals = calibrationPrev.multipliers;
      calibrationDrift = mean([
        Math.abs(nowVals.reserveSleepGain - prevVals.reserveSleepGain),
        Math.abs(nowVals.focusFromStress - prevVals.focusFromStress),
        Math.abs(nowVals.workoutStrain - prevVals.workoutStrain),
        Math.abs(nowVals.circadianRisk - prevVals.circadianRisk),
        Math.abs(nowVals.debtBurnout - prevVals.debtBurnout),
      ]);
      convergenceScore = 1 - clamp(calibrationDrift / 0.25, 0, 1);
    }
  }

  const topPattern = patterns.topPatterns[0];
  const patternScore =
    topPattern && topPattern.severity >= 2 ? clamp(topPattern.confidence, 0, 1) : 0.5;

  let sensitivityScore = 0.5;
  let projectionSpread = 0;
  try {
    const sensitivity = await computeSensitivityScore({
      userId: params.userId,
      endDate,
    });
    sensitivityScore = sensitivity.score;
    projectionSpread = sensitivity.spread;
  } catch {
    sensitivityScore = 0.5;
    projectionSpread = 0;
  }

  const confidence = clamp(
    0.25 * coverageScore +
      0.2 * completenessScore +
      0.2 * stabilityScore +
      0.15 * convergenceScore +
      0.1 * patternScore +
      0.1 * sensitivityScore,
    0,
    1
  );

  const notes: string[] = [];
  if (coverageScore < 0.4) notes.push("Low data coverage");
  if (completenessScore < 0.7) notes.push("Incomplete inputs");
  if (stabilityScore < 0.4) notes.push("High volatility");
  if (convergenceScore < 0.4) notes.push("Calibration not converged");
  if (sensitivityScore < 0.4) notes.push("Low scenario separation");

  return {
    confidence: round3(confidence),
    components: {
      coverageScore: round3(coverageScore),
      completenessScore: round3(completenessScore),
      stabilityScore: round3(stabilityScore),
      convergenceScore: round3(convergenceScore),
      patternScore: round3(patternScore),
      sensitivityScore: round3(sensitivityScore),
      daysWithCheckin,
      meanDelta: round3(meanDelta),
      calibrationDrift: calibrationDrift == null ? null : round3(calibrationDrift),
      projectionSpread: round3(projectionSpread),
      windowDays: WINDOW_DAYS,
    },
    notes,
  };
}

export async function getConfidence(userId: string, endDateISO: string): Promise<ModelConfidenceResult> {
  return computeConfidence({ userId, endDateISO });
}
