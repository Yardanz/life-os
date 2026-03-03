import { Prisma, SystemStatus } from "@prisma/client";
import { computeDayV3 } from "@/lib/scoring/engine";
import { buildCalibrationProfile } from "@/lib/calibration/personalCalibration";
import type {
  ContributionFactorName,
  DailyCheckInInput,
  StatName,
  WeightConfigInput,
} from "@/lib/scoring/types";
import { prisma } from "@/lib/prisma";

const DEFAULT_FACTOR_WEIGHTS: WeightConfigInput["factors"] = {
  Energy: {
    S: { weight: 18, lag: 0 },
    W: { weight: 10, lag: 0 },
    DW: { weight: -5, lag: 0 },
    L: { weight: 4, lag: 0 },
    M: { weight: 3, lag: 0 },
    T: { weight: 12, lag: 0 },
  },
  Focus: {
    S: { weight: 6, lag: 1 },
    W: { weight: 5, lag: 0 },
    DW: { weight: 16, lag: 0 },
    L: { weight: 6, lag: 1 },
    M: { weight: 2, lag: 0 },
    T: { weight: 10, lag: 0 },
  },
  Discipline: {
    S: { weight: 5, lag: 1 },
    W: { weight: 9, lag: 0 },
    DW: { weight: 12, lag: 0 },
    L: { weight: 10, lag: 0 },
    M: { weight: 1, lag: 0 },
    T: { weight: 8, lag: 0 },
  },
  Finance: {
    S: { weight: 2, lag: 0 },
    W: { weight: 0, lag: 0 },
    DW: { weight: 8, lag: 1 },
    L: { weight: 7, lag: 1 },
    M: { weight: 22, lag: 0 },
    T: { weight: 4, lag: 0 },
  },
  Growth: {
    S: { weight: 4, lag: 0 },
    W: { weight: 4, lag: 0 },
    DW: { weight: 9, lag: 0 },
    L: { weight: 16, lag: 0 },
    M: { weight: 1, lag: 0 },
    T: { weight: 6, lag: 0 },
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function circularDistanceMinutes(a: number, b: number): number {
  const diff = Math.abs(a - b) % 1440;
  return Math.min(diff, 1440 - diff);
}

function circularMeanMinutes(values: number[]): number {
  if (values.length === 0) return 0;
  const radians = values.map((value) => (value / 1440) * Math.PI * 2);
  const sinSum = radians.reduce((sum, value) => sum + Math.sin(value), 0);
  const cosSum = radians.reduce((sum, value) => sum + Math.cos(value), 0);
  const angle = Math.atan2(sinSum / values.length, cosSum / values.length);
  const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
  return (normalized / (Math.PI * 2)) * 1440;
}

function circularStdMinutes(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = circularMeanMinutes(values);
  const variance =
    values.reduce((sum, value) => {
      const diff = circularDistanceMinutes(value, mean);
      return sum + diff ** 2;
    }, 0) / values.length;
  return Math.sqrt(variance);
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseRawMetrics(notes: string | null): Partial<Omit<DailyCheckInInput, "date" | "stress">> & {
  stress?: number;
} {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    const bedtimeRaw = parsed.bedtimeMinutes ?? parsed.bedtime_minutes;
    const wakeRaw = parsed.wakeTimeMinutes ?? parsed.wake_time_minutes;
    return {
      sleepHours: Number(parsed.sleepHours ?? parsed.sleep_hours ?? 0),
      sleepQuality: Number(parsed.sleepQuality ?? parsed.sleep_quality ?? 0),
      bedtimeMinutes:
        typeof bedtimeRaw === "number" && Number.isFinite(bedtimeRaw) ? bedtimeRaw : undefined,
      wakeTimeMinutes: typeof wakeRaw === "number" && Number.isFinite(wakeRaw) ? wakeRaw : undefined,
      workout: Number(parsed.workout ?? 0) > 0 ? 1 : 0,
      deepWorkMin: Number(parsed.deepWorkMin ?? parsed.deep_work_min ?? 0),
      learningMin: Number(parsed.learningMin ?? parsed.learning_min ?? 0),
      moneyDelta: Number(parsed.moneyDelta ?? parsed.money_delta ?? 0),
      stress: Number(parsed.stress ?? parsed.stressLevel ?? 0),
    };
  } catch {
    return {};
  }
}

function estimateRiskFromHistoryPoint(params: {
  stress: number | null;
  sleepHours: number | null;
  reserve: number;
  fatigue: number;
  strain: number;
  overloadLevel: number;
  circadianAlignment: number;
  stressLoad: number;
}): number {
  const stressN = clamp(((params.stress ?? 5) - 1) / 9, 0, 1);
  const load = 0.55;
  const sleep = clamp(((params.sleepHours ?? 7) as number) / 8, 0, 1);
  const recovery = clamp((sleep + (1 - stressN)) / 2, 0, 1);
  const reserve = clamp(params.reserve / 100, 0, 1);
  const fatigue = clamp(params.fatigue / 100, 0, 1);
  const strain = clamp(params.strain / 100, 0, 1);
  const recoverySurplus = clamp(recovery - load, -1, 1);
  const pressure =
    0.35 * (1 - reserve) +
    0.3 * fatigue +
    0.25 * strain +
    0.2 * stressN -
    0.25 * Math.max(0, recoverySurplus);
  let risk = (1 / (1 + Math.exp(-((pressure - 0.35) * 6)))) * 100;
  if (params.overloadLevel === 1) risk += 10;
  if (params.overloadLevel >= 2) risk += 20;
  risk += Math.max(0, (50 - params.circadianAlignment) * 0.3);
  risk += params.stressLoad * 0.1;
  return clamp(risk, 0, 100);
}

function toDailyInput(checkin: {
  date: Date;
  notes: string | null;
  stressLevel: number | null;
  bedtimeMinutes: number | null;
  wakeTimeMinutes: number | null;
}): DailyCheckInInput {
  const metrics = parseRawMetrics(checkin.notes);
  const stressFromRecord = checkin.stressLevel ?? metrics.stress ?? 5;
  const bedtimeMinutes =
    typeof checkin.bedtimeMinutes === "number"
      ? checkin.bedtimeMinutes
      : typeof metrics.bedtimeMinutes === "number" && Number.isFinite(metrics.bedtimeMinutes)
        ? metrics.bedtimeMinutes
        : 23 * 60 + 30;
  const wakeTimeMinutes =
    typeof checkin.wakeTimeMinutes === "number"
      ? checkin.wakeTimeMinutes
      : typeof metrics.wakeTimeMinutes === "number" && Number.isFinite(metrics.wakeTimeMinutes)
        ? metrics.wakeTimeMinutes
        : ((bedtimeMinutes + Math.round((metrics.sleepHours ?? 8) * 60)) % 1440 + 1440) % 1440;

  return {
    date: startOfDay(checkin.date),
    stress: clamp(stressFromRecord, 1, 10),
    sleepHours: metrics.sleepHours ?? 0,
    sleepQuality: metrics.sleepQuality ?? 0,
    workout: metrics.workout ?? 0,
    deepWorkMin: metrics.deepWorkMin ?? 0,
    learningMin: metrics.learningMin ?? 0,
    moneyDelta: metrics.moneyDelta ?? 0,
    bedtimeMinutes,
    wakeTimeMinutes,
  };
}

export function buildWeightConfig(config: {
  configVersion: number;
  decayDays: number;
  lagDays: number;
  momentumWeight: number;
  healthWeight: Prisma.Decimal;
  relationWeight: Prisma.Decimal;
  careerWeight: Prisma.Decimal;
  reserveSleepGain: number;
  reserveWorkCost: number;
  reserveStressCost: number;
  fatigueCarry: number;
  fatigueWorkGain: number;
  fatigueStressGain: number;
  fatigueSleepRecovery: number;
  strainCarry: number;
  strainFatigueWeight: number;
  overloadLevel1Threshold: number;
  overloadLevel2Threshold: number;
  overloadRecoverThreshold: number;
  baseFocus: number;
  focusFromEnergy: number;
  focusFromFatigue: number;
  focusFromStress: number;
  optLoadMin: number;
  optLoadMax: number;
  adaptGain: number;
  burnoutPenalty: number;
  disciplineCarry: number;
  debtCarry: number;
  debtRecoveryFactor: number;
  adaptiveCarry: number;
  bufferGain: number;
  bufferCarry: number;
  bufferSpendMax: number;
  reserveFromBuffer: number;
  fatigueFromBuffer: number;
  stressCarry: number;
  stressGain: number;
  stressRecovery: number;
  trainingIn: number;
  trainingCarry: number;
  trainingSpendMax: number;
  trainingReserveBonus: number;
  trainingDisciplineBonus: number;
  trainingAdaptiveBonus: number;
  workoutSameDayCostReserve: number;
  workoutSameDayCostFatigue: number;
  sympCarry: number;
  paraCarry: number;
  sympFromStress: number;
  sympFromLoad: number;
  sympFromStrain: number;
  paraFromSleep: number;
  paraFromRecovery: number;
  paraFromCircadian: number;
  paraSuppressedByStressLoad: number;
}): WeightConfigInput {
  const baseDecay = clamp(1 / Math.max(config.decayDays, 1), 0, 1);
  const baseLag = Math.max(config.lagDays, 0);
  const healthWeight = Number(config.healthWeight);
  const relationWeight = Number(config.relationWeight);
  const careerWeight = Number(config.careerWeight);

  const withLag = Object.fromEntries(
    Object.entries(DEFAULT_FACTOR_WEIGHTS).map(([stat, statMap]) => [
      stat,
      Object.fromEntries(
        Object.entries(statMap).map(([factor, value]) => [
          factor,
          { ...value, lag: Math.max(value.lag, baseLag) },
        ])
      ),
    ])
  ) as WeightConfigInput["factors"];

  return {
    configVersion: config.configVersion,
    overloadK: 12,
    trendDelta: 1.5,
    momentumWeight: config.momentumWeight ?? 0.15,
    decay: {
      Energy: baseDecay,
      Focus: baseDecay,
      Discipline: baseDecay,
      Finance: baseDecay,
      Growth: baseDecay,
    },
    factors: withLag,
    overloadPenaltyWeights: {
      Energy: clamp(healthWeight, 0, 2),
      Focus: clamp(relationWeight, 0, 2),
      Discipline: clamp(careerWeight, 0, 2),
    },
    bio: {
      reserveSleepGain: config.reserveSleepGain,
      reserveWorkCost: config.reserveWorkCost,
      reserveStressCost: config.reserveStressCost,
      fatigueCarry: config.fatigueCarry,
      fatigueWorkGain: config.fatigueWorkGain,
      fatigueStressGain: config.fatigueStressGain,
      fatigueSleepRecovery: config.fatigueSleepRecovery,
      strainCarry: config.strainCarry,
      strainFatigueWeight: config.strainFatigueWeight,
      overloadLevel1Threshold: config.overloadLevel1Threshold,
      overloadLevel2Threshold: config.overloadLevel2Threshold,
      overloadRecoverThreshold: config.overloadRecoverThreshold,
      baseFocus: config.baseFocus,
      focusFromEnergy: config.focusFromEnergy,
      focusFromFatigue: config.focusFromFatigue,
      focusFromStress: config.focusFromStress,
      optLoadMin: config.optLoadMin,
      optLoadMax: config.optLoadMax,
      adaptGain: config.adaptGain,
      burnoutPenalty: config.burnoutPenalty,
      disciplineCarry: config.disciplineCarry,
      debtCarry: config.debtCarry,
      debtRecoveryFactor: config.debtRecoveryFactor,
      adaptiveCarry: config.adaptiveCarry,
      bufferGain: config.bufferGain,
      bufferCarry: config.bufferCarry,
      bufferSpendMax: config.bufferSpendMax,
      reserveFromBuffer: config.reserveFromBuffer,
      fatigueFromBuffer: config.fatigueFromBuffer,
      stressCarry: config.stressCarry,
      stressGain: config.stressGain,
      stressRecovery: config.stressRecovery,
      trainingIn: config.trainingIn,
      trainingCarry: config.trainingCarry,
      trainingSpendMax: config.trainingSpendMax,
      trainingReserveBonus: config.trainingReserveBonus,
      trainingDisciplineBonus: config.trainingDisciplineBonus,
      trainingAdaptiveBonus: config.trainingAdaptiveBonus,
      workoutSameDayCostReserve: config.workoutSameDayCostReserve,
      workoutSameDayCostFatigue: config.workoutSameDayCostFatigue,
      sympCarry: config.sympCarry,
      paraCarry: config.paraCarry,
      sympFromStress: config.sympFromStress,
      sympFromLoad: config.sympFromLoad,
      sympFromStrain: config.sympFromStrain,
      paraFromSleep: config.paraFromSleep,
      paraFromRecovery: config.paraFromRecovery,
      paraFromCircadian: config.paraFromCircadian,
      paraSuppressedByStressLoad: config.paraSuppressedByStressLoad,
    },
  };
}

function factorToDbType(factor: ContributionFactorName): string {
  switch (factor) {
    case "S":
      return "SLEEP";
    case "W":
      return "WORKOUT";
    case "DW":
      return "DEEP_WORK";
    case "L":
      return "LEARNING";
    case "M":
      return "MONEY_DELTA";
    case "T":
      return "STRESS";
    case "OVERLOAD":
      return "OVERLOAD";
    case "MOMENTUM":
      return "MOMENTUM";
    default:
      return "STRESS";
  }
}

function statToDbType(stat: StatName): string {
  switch (stat) {
    case "Energy":
      return "ENERGY";
    case "Focus":
      return "FOCUS";
    case "Discipline":
      return "DISCIPLINE";
    case "Finance":
      return "FINANCE";
    case "Growth":
      return "GROWTH";
    default:
      return "ENERGY";
  }
}

function statusToDb(status: string): SystemStatus {
  if (status === "Overloaded") return SystemStatus.CRITICAL;
  if (status === "Declining") return SystemStatus.WARNING;
  return SystemStatus.STABLE;
}

export async function recalculateDay(userId: string, date: Date) {
  const day = startOfDay(date);
  const dayMinus13 = new Date(day);
  dayMinus13.setUTCDate(dayMinus13.getUTCDate() - 13);

  const checkin = await prisma.dailyCheckIn.findUnique({
    where: { userId_date: { userId, date: day } },
    select: {
      id: true,
      userId: true,
      date: true,
      stressLevel: true,
      bedtimeMinutes: true,
      wakeTimeMinutes: true,
      notes: true,
      configVersion: true,
    },
  });

  if (!checkin) {
    throw new Error(`DailyCheckIn not found for date=${day.toISOString()}`);
  }

  const config = await prisma.weightConfig.findUnique({
    where: { configVersion: checkin.configVersion },
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

  if (!config) {
    throw new Error(`WeightConfig version=${checkin.configVersion} not found`);
  }

  const engineConfig = buildWeightConfig(config);
  const userAdaptive = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      adaptiveRiskOffset: true,
      adaptiveRecoveryOffset: true,
    },
  });

  const previousSnapshots = await prisma.statSnapshot.findMany({
    where: {
      userId,
      date: { lt: day },
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
    },
  });

  const previousSnapshot = previousSnapshots[0];
  const previousPreviousSnapshot = previousSnapshots[1];

  const last7Checkins = await prisma.dailyCheckIn.findMany({
    where: {
      userId,
      date: { lte: day },
    },
    orderBy: { date: "desc" },
    take: 7,
    select: {
      notes: true,
      bedtimeMinutes: true,
      wakeTimeMinutes: true,
    },
  });
  const timingSeries = last7Checkins
    .map((item) => {
      const metrics = parseRawMetrics(item.notes);
      const bedtime =
        typeof item.bedtimeMinutes === "number"
          ? item.bedtimeMinutes
          : typeof metrics.bedtimeMinutes === "number" && Number.isFinite(metrics.bedtimeMinutes)
            ? metrics.bedtimeMinutes
            : null;
      const wake =
        typeof item.wakeTimeMinutes === "number"
          ? item.wakeTimeMinutes
          : typeof metrics.wakeTimeMinutes === "number" && Number.isFinite(metrics.wakeTimeMinutes)
            ? metrics.wakeTimeMinutes
            : null;
      return { bedtime, wake };
    })
    .filter(
      (value): value is { bedtime: number; wake: number } =>
        typeof value.bedtime === "number" &&
        Number.isFinite(value.bedtime) &&
        typeof value.wake === "number" &&
        Number.isFinite(value.wake)
    );

  const wakeSeries = timingSeries.map((item) => item.wake);
  const wakeStd = wakeSeries.length >= 3 ? circularStdMinutes(wakeSeries) : 0;
  const regularityPenalty =
    wakeSeries.length >= 3
      ? 6 * clamp((wakeStd / 60 - 0.3) / 1.2, 0, 1)
      : 0;
  const sleepRegularity = clamp(100 - regularityPenalty * 10, 0, 100);

  const currentDaily = toDailyInput(checkin);
  const meanWake = wakeSeries.length >= 3 ? circularMeanMinutes(wakeSeries) : currentDaily.wakeTimeMinutes ?? 7 * 60;
  const wakeDeviationMinutes = circularDistanceMinutes(currentDaily.wakeTimeMinutes ?? meanWake, meanWake);
  const t0 = 30;
  const t1 = 90;
  const maxP = 12;
  const x = clamp((wakeDeviationMinutes - t0) / (t1 - t0), 0, 1);
  const soft = x ** 2;
  const tail = clamp((wakeDeviationMinutes - t1) / 120, 0, 1);
  const rawCircadianPenalty = maxP * (0.35 * soft + 0.65 * tail);

  const last3Checkins = await prisma.dailyCheckIn.findMany({
    where: {
      userId,
      date: { lte: day },
    },
    orderBy: { date: "desc" },
    take: 3,
    select: {
      notes: true,
    },
  });
  const totalDeepWork3d = last3Checkins.reduce((sum, item) => {
    const value = parseRawMetrics(item.notes).deepWorkMin;
    return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
  const cognitiveSaturation = clamp((totalDeepWork3d / 360) * 100, 0, 100);

  const previousBioStates = await prisma.bioStateSnapshot.findMany({
    where: {
      userId,
      date: { lt: day },
    },
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

  const prevBioState = previousBioStates[0];
  const prevPrevBioState = previousBioStates[1];
  const prevCircadianPenalty = prevBioState ? clamp(100 - prevBioState.circadianAlignment, 0, 100) : rawCircadianPenalty;
  const circadianAlignmentPenalty = clamp(prevCircadianPenalty * 0.4 + rawCircadianPenalty * 0.6, 0, 100);

  const lifeScoreHistoryRows = await prisma.statSnapshot.findMany({
    where: {
      userId,
      date: { lt: day },
    },
    orderBy: { date: "desc" },
    take: 7,
    select: { lifeScore: true },
  });

  const recent3 = lifeScoreHistoryRows.slice(0, 3).map((row) => Number(row.lifeScore));
  const previous3 = lifeScoreHistoryRows.slice(3, 6).map((row) => Number(row.lifeScore));
  const lifeScoreTrend =
    recent3.length === 3 && previous3.length === 3
      ? recent3.reduce((sum, v) => sum + v, 0) / 3 - previous3.reduce((sum, v) => sum + v, 0) / 3
      : 0;

  const result = computeDayV3({
    checkIn: {
      ...currentDaily,
      sleepRegularity,
      cognitiveSaturation,
      circadianAlignmentPenalty,
      regularityPenalty,
    },
    previousSnapshot: previousSnapshot
      ? {
          date: previousSnapshot.date,
          lifeScore: Number(previousSnapshot.lifeScore),
          stats: {
            Energy: Number(previousSnapshot.health),
            Focus: Number(previousSnapshot.relationships),
            Discipline: Number(previousSnapshot.career),
            Finance: Number(previousSnapshot.finance),
            Growth: Number(previousSnapshot.personalGrowth),
          },
        }
      : undefined,
    previousPreviousSnapshot: previousPreviousSnapshot
      ? {
          date: previousPreviousSnapshot.date,
          lifeScore: Number(previousPreviousSnapshot.lifeScore),
          stats: {
            Energy: Number(previousPreviousSnapshot.health),
            Focus: Number(previousPreviousSnapshot.relationships),
            Discipline: Number(previousPreviousSnapshot.career),
            Finance: Number(previousPreviousSnapshot.finance),
            Growth: Number(previousPreviousSnapshot.personalGrowth),
          },
        }
      : undefined,
    prevBioState: prevBioState
      ? {
          date: prevBioState.date,
          energyReserve: prevBioState.energyReserve,
          cognitiveFatigue: prevBioState.cognitiveFatigue,
          strainIndex: prevBioState.strainIndex,
          overloadLevel: Math.max(0, Math.min(2, prevBioState.overloadLevel)) as 0 | 1 | 2,
          recoveryDebt: prevBioState.recoveryDebt,
          adaptiveCapacity: prevBioState.adaptiveCapacity,
          sleepBuffer: prevBioState.sleepBuffer,
          circadianAlignment: prevBioState.circadianAlignment,
          sleepRegularity: prevBioState.sleepRegularity,
          stressLoad: prevBioState.stressLoad,
          trainingBuffer: prevBioState.trainingBuffer,
          homeostasisBias: prevBioState.homeostasisBias,
          cognitiveSaturation: prevBioState.cognitiveSaturation,
          sympatheticDrive: prevBioState.sympatheticDrive,
          parasympatheticDrive: prevBioState.parasympatheticDrive,
          autonomicBalance: prevBioState.autonomicBalance,
          hormeticSignal: prevBioState.hormeticSignal,
          overstressSignal: prevBioState.overstressSignal,
          burnoutRiskIndex: prevBioState.burnoutRiskIndex,
          resilienceIndex: prevBioState.resilienceIndex,
        }
      : undefined,
    prevPrevBioState: prevPrevBioState
      ? {
          date: prevPrevBioState.date,
          energyReserve: prevPrevBioState.energyReserve,
          cognitiveFatigue: prevPrevBioState.cognitiveFatigue,
          strainIndex: prevPrevBioState.strainIndex,
          overloadLevel: Math.max(0, Math.min(2, prevPrevBioState.overloadLevel)) as 0 | 1 | 2,
          recoveryDebt: prevPrevBioState.recoveryDebt,
          adaptiveCapacity: prevPrevBioState.adaptiveCapacity,
          sleepBuffer: prevPrevBioState.sleepBuffer,
          circadianAlignment: prevPrevBioState.circadianAlignment,
          sleepRegularity: prevPrevBioState.sleepRegularity,
          stressLoad: prevPrevBioState.stressLoad,
          trainingBuffer: prevPrevBioState.trainingBuffer,
          homeostasisBias: prevPrevBioState.homeostasisBias,
          cognitiveSaturation: prevPrevBioState.cognitiveSaturation,
          sympatheticDrive: prevPrevBioState.sympatheticDrive,
          parasympatheticDrive: prevPrevBioState.parasympatheticDrive,
          autonomicBalance: prevPrevBioState.autonomicBalance,
          hormeticSignal: prevPrevBioState.hormeticSignal,
          overstressSignal: prevPrevBioState.overstressSignal,
          burnoutRiskIndex: prevPrevBioState.burnoutRiskIndex,
          resilienceIndex: prevPrevBioState.resilienceIndex,
        }
      : undefined,
    config: engineConfig,
    previousLifeScores: lifeScoreHistoryRows.map((row) => Number(row.lifeScore)),
    lifeScoreTrend,
    calibration: await buildCalibrationProfile({
      userId,
      endDate: day,
      windowDays: 30,
    }),
  });

  const [historyCheckins, historyBios] = await Promise.all([
    prisma.dailyCheckIn.findMany({
      where: {
        userId,
        date: {
          gte: dayMinus13,
          lt: day,
        },
      },
      select: {
        date: true,
        stressLevel: true,
        notes: true,
      },
    }),
    prisma.bioStateSnapshot.findMany({
      where: {
        userId,
        date: {
          gte: dayMinus13,
          lt: day,
        },
      },
      select: {
        date: true,
        energyReserve: true,
        cognitiveFatigue: true,
        strainIndex: true,
        overloadLevel: true,
        circadianAlignment: true,
        stressLoad: true,
      },
    }),
  ]);

  const checkinByDate = new Map(
    historyCheckins.map((row) => [startOfDay(row.date).toISOString(), row] as const)
  );
  const historicalRisks = historyBios.map((bio) => {
    const key = startOfDay(bio.date).toISOString();
    const row = checkinByDate.get(key);
    const parsed = parseRawMetrics(row?.notes ?? null);
    const stress = row?.stressLevel ?? parsed.stress ?? null;
    const sleepHours =
      typeof parsed.sleepHours === "number" && Number.isFinite(parsed.sleepHours)
        ? parsed.sleepHours
        : null;
    return estimateRiskFromHistoryPoint({
      stress,
      sleepHours,
      reserve: bio.energyReserve,
      fatigue: bio.cognitiveFatigue,
      strain: bio.strainIndex,
      overloadLevel: bio.overloadLevel,
      circadianAlignment: bio.circadianAlignment,
      stressLoad: bio.stressLoad,
    });
  });
  const avgRisk14d = average([...historicalRisks, clamp(result.risk, 0, 100)]);
  let adaptiveRiskOffset = userAdaptive?.adaptiveRiskOffset ?? 0;
  let adaptiveRecoveryOffset = userAdaptive?.adaptiveRecoveryOffset ?? 0;
  if (avgRisk14d > 75) {
    adaptiveRiskOffset += 0.4;
    adaptiveRecoveryOffset -= 0.3;
  } else if (avgRisk14d < 45) {
    adaptiveRiskOffset -= 0.3;
    adaptiveRecoveryOffset += 0.4;
  }
  adaptiveRiskOffset = clamp(adaptiveRiskOffset, -20, 25);
  adaptiveRecoveryOffset = clamp(adaptiveRecoveryOffset, -20, 20);

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        adaptiveRiskOffset,
        adaptiveRecoveryOffset,
      },
    });

    await tx.bioStateSnapshot.upsert({
      where: { userId_date: { userId, date: day } },
      update: {
        energyReserve: result.nextBioState.energyReserve,
        cognitiveFatigue: result.nextBioState.cognitiveFatigue,
        strainIndex: result.nextBioState.strainIndex,
        overloadLevel: result.nextBioState.overloadLevel,
        recoveryDebt: result.nextBioState.recoveryDebt,
        adaptiveCapacity: result.nextBioState.adaptiveCapacity,
        sleepBuffer: result.nextBioState.sleepBuffer,
        circadianAlignment: result.nextBioState.circadianAlignment,
        sleepRegularity: result.nextBioState.sleepRegularity,
        stressLoad: result.nextBioState.stressLoad,
        trainingBuffer: result.nextBioState.trainingBuffer,
        homeostasisBias: result.nextBioState.homeostasisBias,
        cognitiveSaturation: result.nextBioState.cognitiveSaturation,
        sympatheticDrive: result.nextBioState.sympatheticDrive,
        parasympatheticDrive: result.nextBioState.parasympatheticDrive,
        autonomicBalance: result.nextBioState.autonomicBalance,
        hormeticSignal: result.nextBioState.hormeticSignal,
        overstressSignal: result.nextBioState.overstressSignal,
        burnoutRiskIndex: result.nextBioState.burnoutRiskIndex,
        resilienceIndex: result.nextBioState.resilienceIndex,
      },
      create: {
        userId,
        date: day,
        energyReserve: result.nextBioState.energyReserve,
        cognitiveFatigue: result.nextBioState.cognitiveFatigue,
        strainIndex: result.nextBioState.strainIndex,
        overloadLevel: result.nextBioState.overloadLevel,
        recoveryDebt: result.nextBioState.recoveryDebt,
        adaptiveCapacity: result.nextBioState.adaptiveCapacity,
        sleepBuffer: result.nextBioState.sleepBuffer,
        circadianAlignment: result.nextBioState.circadianAlignment,
        sleepRegularity: result.nextBioState.sleepRegularity,
        stressLoad: result.nextBioState.stressLoad,
        trainingBuffer: result.nextBioState.trainingBuffer,
        homeostasisBias: result.nextBioState.homeostasisBias,
        cognitiveSaturation: result.nextBioState.cognitiveSaturation,
        sympatheticDrive: result.nextBioState.sympatheticDrive,
        parasympatheticDrive: result.nextBioState.parasympatheticDrive,
        autonomicBalance: result.nextBioState.autonomicBalance,
        hormeticSignal: result.nextBioState.hormeticSignal,
        overstressSignal: result.nextBioState.overstressSignal,
        burnoutRiskIndex: result.nextBioState.burnoutRiskIndex,
        resilienceIndex: result.nextBioState.resilienceIndex,
      },
    });

    const snapshot = await tx.statSnapshot.upsert({
      where: { userId_date: { userId, date: day } },
      update: {
        health: result.stats.Energy,
        relationships: result.stats.Focus,
        career: result.stats.Discipline,
        finance: result.stats.Finance,
        personalGrowth: result.stats.Growth,
        lifeScore: result.lifeScore,
        configVersion: result.configVersion,
        systemStatus: statusToDb(result.status),
      },
      create: {
        userId,
        date: day,
        health: result.stats.Energy,
        relationships: result.stats.Focus,
        career: result.stats.Discipline,
        finance: result.stats.Finance,
        personalGrowth: result.stats.Growth,
        lifeScore: result.lifeScore,
        configVersion: result.configVersion,
        systemStatus: statusToDb(result.status),
      },
    });

    await tx.statContribution.deleteMany({
      where: {
        userId,
        snapshotId: snapshot.id,
      },
    });

    const contributionRows = result.contributions.map(
      (line) =>
        ({
          userId,
          snapshotId: snapshot.id,
          date: day,
          statType: statToDbType(line.stat) as never,
          factorType: factorToDbType(line.factor) as never,
          contribution: line.contribution,
        }) as unknown as Prisma.StatContributionCreateManyInput
    );

    await tx.statContribution.createMany({
      data: contributionRows,
      skipDuplicates: true,
    });

    return {
      snapshotId: snapshot.id,
      adaptiveRiskOffset,
      adaptiveRecoveryOffset,
      ...result,
    };
  });
}
