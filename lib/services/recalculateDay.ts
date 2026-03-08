import { Prisma, SystemStatus, UserPlan } from "@prisma/client";
import { buildProtocol, type ProtocolMode } from "@/lib/engine/protocolRules";
import { evaluateGuardrail } from "@/lib/guardrails/guardrailEngine";
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

function diffUtcDays(later: Date, earlier: Date): number {
  const a = startOfDay(later).getTime();
  const b = startOfDay(earlier).getTime();
  return Math.max(0, Math.floor((a - b) / 86400000));
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

function computeProtocolInputsFromBio(args: {
  energyReserve: number;
  cognitiveFatigue: number;
  strainIndex: number;
  stressLoad: number;
  burnoutRiskIndex: number;
  parasympatheticDrive: number;
  resilienceIndex: number;
}): { load: number; recovery: number; risk: number; burnout: number } {
  const load = clamp(args.cognitiveFatigue * 0.45 + args.strainIndex * 0.35 + args.stressLoad * 0.2, 0, 100);
  const recovery = clamp(args.energyReserve * 0.45 + args.parasympatheticDrive * 0.25 + args.resilienceIndex * 0.3, 0, 100);
  const risk = clamp(args.burnoutRiskIndex * 0.5 + args.strainIndex * 0.35 + (100 - args.energyReserve) * 0.15, 0, 100);
  return {
    load: Math.round(load * 10) / 10,
    recovery: Math.round(recovery * 10) / 10,
    risk: Math.round(risk * 10) / 10,
    burnout: Math.round(clamp(args.burnoutRiskIndex, 0, 100) * 10) / 10,
  };
}

function resolveAutoProtocolPlan(input: {
  guardrail: "OPEN" | "CAUTION" | "LOCKDOWN";
  userPlan: UserPlan | null | undefined;
  currentRisk: number;
  burnout: number;
  recoveryDebt: number;
  adaptiveCapacity: number;
  lifeScoreTrend: number;
  riskDelta7d: number;
  recoveryPatternStreakDays?: number;
  recoveryPatternStrength?: number;
}): {
  shouldGenerate: boolean;
  guardrailState: "OPEN" | "CAUTION" | "LOCKDOWN";
  mode: ProtocolMode;
  horizonHours: 24 | 48 | 72;
  triggerReasons: string[];
} {
  const pro = input.userPlan === "PRO";
  const triggerReasons: string[] = [];
  const recoveryPatternStreakDays = Math.max(0, Math.round(input.recoveryPatternStreakDays ?? 0));
  const recoveryPatternStrength = clamp(input.recoveryPatternStrength ?? 0, 0, 1);
  const sustainedRecovery =
    recoveryPatternStreakDays >= 4 && recoveryPatternStrength >= 0.58 && input.riskDelta7d <= -3;

  const nearLockdown =
    input.guardrail === "LOCKDOWN" ||
    input.currentRisk >= 82 ||
    input.burnout >= 78 ||
    (input.recoveryDebt >= 76 && input.adaptiveCapacity <= 34);
  if (nearLockdown) {
    triggerReasons.push("near_lockdown");
  }

  const cautionStrain =
    input.guardrail === "CAUTION" ||
    input.currentRisk >= 62 ||
    input.burnout >= 60 ||
    input.lifeScoreTrend <= -4 ||
    input.riskDelta7d >= 8 ||
    (input.recoveryDebt >= 58 && input.adaptiveCapacity <= 45);
  if (cautionStrain) {
    triggerReasons.push("caution_strain");
  }

  const openDrift =
    input.guardrail === "OPEN" &&
    ((input.currentRisk >= 58 && input.lifeScoreTrend <= -4) ||
      input.riskDelta7d >= 10 ||
      (input.recoveryDebt >= 62 && input.adaptiveCapacity <= 42));
  if (openDrift) {
    triggerReasons.push("open_drift");
  }

  if (
    sustainedRecovery &&
    input.guardrail !== "LOCKDOWN" &&
    input.currentRisk <= 70 &&
    input.burnout <= 72 &&
    input.recoveryDebt <= 76 &&
    input.lifeScoreTrend >= -2
  ) {
    return {
      shouldGenerate: false,
      guardrailState: input.guardrail,
      mode: "STANDARD",
      horizonHours: 24,
      triggerReasons: ["sustained_recovery_relief"],
    };
  }

  if (!nearLockdown && !cautionStrain && !openDrift) {
    return {
      shouldGenerate: false,
      guardrailState: input.guardrail,
      mode: "STANDARD",
      horizonHours: 24,
      triggerReasons: [],
    };
  }

  if (nearLockdown) {
    return {
      shouldGenerate: true,
      guardrailState: input.guardrail === "LOCKDOWN" ? "LOCKDOWN" : "CAUTION",
      mode: pro ? "STABILIZE" : "STANDARD",
      horizonHours: pro ? (input.currentRisk >= 88 || input.burnout >= 84 ? 72 : 48) : 24,
      triggerReasons,
    };
  }

  if (cautionStrain) {
    const stabilize =
      pro &&
      (input.currentRisk >= 70 ||
        input.burnout >= 68 ||
        input.recoveryDebt >= 65 ||
        input.adaptiveCapacity <= 40 ||
        input.lifeScoreTrend <= -6 ||
        input.riskDelta7d >= 10);
    return {
      shouldGenerate: true,
      guardrailState: input.guardrail === "LOCKDOWN" ? "LOCKDOWN" : "CAUTION",
      mode: stabilize ? "STABILIZE" : "STANDARD",
      horizonHours: stabilize ? 48 : 24,
      triggerReasons,
    };
  }

  return {
    shouldGenerate: true,
    guardrailState: "OPEN",
    mode: pro ? "STABILIZE" : "STANDARD",
    horizonHours: 24,
    triggerReasons,
  };
}

const AUTO_ANTI_CHAOS_REASON = "AutoCascadeGuard";

function countTrailingTrue(values: boolean[]): number {
  let count = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (!values[index]) break;
    count += 1;
  }
  return count;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

interface RecoveryHistoryCheckinRow {
  date: Date;
  stressLevel: number | null;
  notes: string | null;
}

interface RecoveryHistoryBioRow {
  date: Date;
  energyReserve: number;
  cognitiveFatigue: number;
  strainIndex: number;
  overloadLevel: number;
  recoveryDebt: number;
  adaptiveCapacity: number;
  circadianAlignment: number;
  stressLoad: number;
}

interface RecoveryTrendPoint {
  date: Date;
  sleepHours: number;
  sleepQuality: number;
  stress: number;
  deepWorkMin: number;
  workout: number;
  circadianAlignment: number;
  risk: number;
  recoveryDebt: number;
  adaptiveCapacity: number;
}

function buildRecoveryTrendPoints(input: {
  historyCheckins: RecoveryHistoryCheckinRow[];
  historyBios: RecoveryHistoryBioRow[];
}): RecoveryTrendPoint[] {
  const checkinByDate = new Map(
    input.historyCheckins.map((row) => [startOfDay(row.date).toISOString(), row] as const)
  );
  const points: RecoveryTrendPoint[] = [];

  for (const bio of input.historyBios) {
    const key = startOfDay(bio.date).toISOString();
    const checkin = checkinByDate.get(key);
    if (!checkin) continue;
    const parsed = parseRawMetrics(checkin.notes);
    const stress = clamp(checkin.stressLevel ?? parsed.stress ?? 5, 1, 10);
    const sleepHours = clamp(
      typeof parsed.sleepHours === "number" && Number.isFinite(parsed.sleepHours) ? parsed.sleepHours : 7,
      0,
      12
    );
    const sleepQuality = clamp(
      typeof parsed.sleepQuality === "number" && Number.isFinite(parsed.sleepQuality) ? parsed.sleepQuality : 3,
      0,
      5
    );
    const deepWorkMin = clamp(
      typeof parsed.deepWorkMin === "number" && Number.isFinite(parsed.deepWorkMin) ? parsed.deepWorkMin : 90,
      0,
      360
    );
    const workout = clamp(
      typeof parsed.workout === "number" && Number.isFinite(parsed.workout) ? parsed.workout : 0,
      0,
      1
    );
    const risk = estimateRiskFromHistoryPoint({
      stress,
      sleepHours,
      reserve: bio.energyReserve,
      fatigue: bio.cognitiveFatigue,
      strain: bio.strainIndex,
      overloadLevel: bio.overloadLevel,
      circadianAlignment: bio.circadianAlignment,
      stressLoad: bio.stressLoad,
    });
    points.push({
      date: startOfDay(bio.date),
      sleepHours,
      sleepQuality,
      stress,
      deepWorkMin,
      workout,
      circadianAlignment: clamp(bio.circadianAlignment, 0, 100),
      risk,
      recoveryDebt: clamp(bio.recoveryDebt, 0, 100),
      adaptiveCapacity: clamp(bio.adaptiveCapacity, 0, 100),
    });
  }

  return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function assessRecoveryTrendDay(
  current: RecoveryTrendPoint,
  previous: RecoveryTrendPoint
): {
  positive: boolean;
  signalRatio: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let signals = 0;
  const totalSignals = 10;

  const register = (condition: boolean, reason: string) => {
    if (!condition) return;
    signals += 1;
    reasons.push(reason);
  };

  register(
    current.sleepHours >= 6.8 || current.sleepHours >= previous.sleepHours + 0.15,
    "sleep_duration_up"
  );
  register(
    current.sleepQuality >= 3.4 || current.sleepQuality >= previous.sleepQuality + 0.1,
    "sleep_quality_up"
  );
  register(current.stress <= 5.8 || current.stress <= previous.stress - 0.2, "stress_load_down");
  register(
    current.deepWorkMin <= 100 || current.deepWorkMin <= previous.deepWorkMin - 10,
    "overload_pressure_down"
  );
  register(current.circadianAlignment >= previous.circadianAlignment + 1.5, "circadian_alignment_up");
  register(current.workout >= previous.workout || current.workout >= 1, "movement_returning");
  register(current.risk <= previous.risk + 0.8, "risk_not_accelerating");
  register(current.recoveryDebt <= previous.recoveryDebt + 0.8, "recovery_debt_stable");
  register(current.adaptiveCapacity >= previous.adaptiveCapacity - 0.5, "adaptive_capacity_held");
  register(
    current.sleepHours * (current.sleepQuality / 5) >= 5.2 ||
      current.sleepHours * (current.sleepQuality / 5) >=
        previous.sleepHours * (previous.sleepQuality / 5) + 0.2,
    "sleep_recovery_effective"
  );

  const hardRegression =
    current.risk - previous.risk >= 4 ||
    current.recoveryDebt - previous.recoveryDebt >= 4 ||
    previous.adaptiveCapacity - current.adaptiveCapacity >= 4 ||
    (current.stress >= 8 && current.sleepHours <= 6) ||
    previous.circadianAlignment - current.circadianAlignment >= 8;
  return {
    positive: signals >= 5 && !hardRegression,
    signalRatio: signals / totalSignals,
    reasons,
  };
}

function assessCurrentRecoveryInput(input: {
  currentDaily: DailyCheckInInput;
  currentCircadianAlignment: number;
  recentPoints: RecoveryTrendPoint[];
  provisionalRisk: number;
}): {
  positive: boolean;
  signalRatio: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let signals = 0;
  const totalSignals = 8;
  const baselineSleepHours = input.recentPoints.length > 0 ? average(input.recentPoints.map((row) => row.sleepHours)) : 7;
  const baselineSleepQuality =
    input.recentPoints.length > 0 ? average(input.recentPoints.map((row) => row.sleepQuality)) : 3;
  const baselineStress = input.recentPoints.length > 0 ? average(input.recentPoints.map((row) => row.stress)) : 5.5;
  const baselineDeepWork =
    input.recentPoints.length > 0 ? average(input.recentPoints.map((row) => row.deepWorkMin)) : 95;
  const baselineRisk = input.recentPoints.length > 0 ? average(input.recentPoints.map((row) => row.risk)) : 58;
  const baselineCircadian =
    input.recentPoints.length > 0 ? average(input.recentPoints.map((row) => row.circadianAlignment)) : 65;
  const baselineWorkoutRate =
    input.recentPoints.length > 0 ? average(input.recentPoints.map((row) => row.workout)) : 0.2;
  const loadApprox = clamp(input.currentDaily.deepWorkMin / 120, 0, 1);
  const recoveryApprox = clamp(
    (input.currentDaily.sleepHours / 8) * (input.currentDaily.sleepQuality / 5) * 0.7 +
      (1 - (input.currentDaily.stress - 1) / 9) * 0.3,
    0,
    1
  );

  const register = (condition: boolean, reason: string) => {
    if (!condition) return;
    signals += 1;
    reasons.push(reason);
  };

  register(
    input.currentDaily.sleepHours >= 6.9 || input.currentDaily.sleepHours >= baselineSleepHours + 0.15,
    "sleep_duration_up"
  );
  register(
    input.currentDaily.sleepQuality >= 3.4 || input.currentDaily.sleepQuality >= baselineSleepQuality + 0.1,
    "sleep_quality_up"
  );
  register(
    input.currentDaily.stress <= 5.8 || input.currentDaily.stress <= baselineStress - 0.2,
    "stress_load_down"
  );
  register(
    input.currentDaily.deepWorkMin <= 100 || input.currentDaily.deepWorkMin <= baselineDeepWork - 10,
    "overload_pressure_down"
  );
  register(
    input.currentCircadianAlignment >= baselineCircadian + 1.5 || input.currentCircadianAlignment >= 68,
    "circadian_alignment_up"
  );
  register(
    (input.currentDaily.workout > 0 && baselineWorkoutRate <= 0.35) ||
      (input.currentDaily.workout > 0 && input.currentDaily.stress <= baselineStress),
    "movement_returning"
  );
  register(input.provisionalRisk <= baselineRisk + 0.8, "risk_not_accelerating");
  register(recoveryApprox >= loadApprox - 0.04, "recovery_load_balance");

  return {
    positive: signals >= 5,
    signalRatio: signals / totalSignals,
    reasons,
  };
}

function countTrailingImprovementTransitions(
  points: RecoveryTrendPoint[],
  predicate: (current: RecoveryTrendPoint, previous: RecoveryTrendPoint) => boolean
): number {
  if (points.length < 2) return 0;
  let count = 0;
  for (let index = points.length - 1; index >= 1; index -= 1) {
    const current = points[index];
    const previous = points[index - 1];
    if (diffUtcDays(current.date, previous.date) > 1) break;
    if (!predicate(current, previous)) break;
    count += 1;
  }
  return count;
}

function resolveRecoveryPatternForControl(input: {
  day: Date;
  currentDaily: DailyCheckInInput;
  currentCircadianAlignment: number;
  prevBioState:
    | {
        energyReserve: number;
        cognitiveFatigue: number;
        strainIndex: number;
        overloadLevel: number;
        circadianAlignment: number;
        stressLoad: number;
      }
    | null
    | undefined;
  historyCheckins: RecoveryHistoryCheckinRow[];
  historyBios: RecoveryHistoryBioRow[];
}):
  | {
      streakDays: number;
      strength: number;
      reasons: string[];
    }
  | null {
  const trendPoints = buildRecoveryTrendPoints({
    historyCheckins: input.historyCheckins,
    historyBios: input.historyBios,
  });
  const recentPoints = trendPoints.slice(-3);
  const provisionalRisk = input.prevBioState
    ? estimateRiskFromHistoryPoint({
        stress: input.currentDaily.stress,
        sleepHours: input.currentDaily.sleepHours,
        reserve: input.prevBioState.energyReserve,
        fatigue: input.prevBioState.cognitiveFatigue,
        strain: input.prevBioState.strainIndex,
        overloadLevel: input.prevBioState.overloadLevel,
        circadianAlignment: input.prevBioState.circadianAlignment,
        stressLoad: input.prevBioState.stressLoad,
      })
    : clamp(42 + (input.currentDaily.stress - 5) * 5 - (input.currentDaily.sleepHours - 7) * 3, 0, 100);
  const currentAssessment = assessCurrentRecoveryInput({
    currentDaily: input.currentDaily,
    currentCircadianAlignment: clamp(input.currentCircadianAlignment, 0, 100),
    recentPoints,
    provisionalRisk,
  });

  if (trendPoints.length < 2) {
    if (!currentAssessment.positive) return null;
    return {
      streakDays: 1,
      strength: clamp(currentAssessment.signalRatio * 0.55, 0, 1),
      reasons: uniqueStrings(currentAssessment.reasons).slice(0, 8),
    };
  }

  const assessments = trendPoints.slice(1).map((point, index) => {
    const previous = trendPoints[index];
    const assessment = assessRecoveryTrendDay(point, previous);
    return {
      index: index + 1,
      date: point.date,
      previousDate: previous.date,
      ...assessment,
    };
  });

  let trailingTransitions = 0;
  const trailingSignalRatios: number[] = [];
  const trailingReasons: string[] = [];
  for (let index = assessments.length - 1; index >= 0; index -= 1) {
    const item = assessments[index];
    if (!item.positive) break;
    if (diffUtcDays(item.date, item.previousDate) > 1) break;
    trailingTransitions += 1;
    trailingSignalRatios.push(item.signalRatio);
    trailingReasons.push(...item.reasons);
  }

  const lastPoint = trendPoints[trendPoints.length - 1];
  const hasContiguousCurrentDay = diffUtcDays(input.day, lastPoint.date) <= 1;
  const historicalStreakDays = trailingTransitions > 0 ? trailingTransitions + 1 : 0;
  const streakDays =
    currentAssessment.positive && hasContiguousCurrentDay
      ? historicalStreakDays > 0
        ? historicalStreakDays + 1
        : 1
      : historicalStreakDays;

  if (streakDays <= 0) return null;

  const sleepDurationStreak = countTrailingImprovementTransitions(
    trendPoints,
    (current, previous) => current.sleepHours >= previous.sleepHours + 0.1 || current.sleepHours >= 6.9
  );
  const sleepQualityStreak = countTrailingImprovementTransitions(
    trendPoints,
    (current, previous) => current.sleepQuality >= previous.sleepQuality + 0.08 || current.sleepQuality >= 3.5
  );
  const stressReliefStreak = countTrailingImprovementTransitions(
    trendPoints,
    (current, previous) => current.stress <= previous.stress - 0.08 || current.stress <= 5.8
  );
  const deepWorkReliefStreak = countTrailingImprovementTransitions(
    trendPoints,
    (current, previous) => current.deepWorkMin <= previous.deepWorkMin - 8 || current.deepWorkMin <= 105
  );
  const circadianStreak = countTrailingImprovementTransitions(
    trendPoints,
    (current, previous) =>
      current.circadianAlignment >= previous.circadianAlignment + 1.2 || current.circadianAlignment >= 68
  );
  const movementReturnStreak = countTrailingImprovementTransitions(
    trendPoints,
    (current, previous) => current.workout >= 1 || (current.workout >= previous.workout && current.workout > 0)
  );
  const sustainedDimensionCount =
    (sleepDurationStreak >= 3 ? 1 : 0) +
    (sleepQualityStreak >= 3 ? 1 : 0) +
    (stressReliefStreak >= 3 ? 1 : 0) +
    (deepWorkReliefStreak >= 3 ? 1 : 0) +
    (circadianStreak >= 3 ? 1 : 0) +
    (movementReturnStreak >= 2 ? 1 : 0);
  const sustainedImprovementDetected = sustainedDimensionCount >= 3;

  const riskRecent = trendPoints.slice(-3).map((point) => point.risk);
  const riskPrev = trendPoints.slice(-6, -3).map((point) => point.risk);
  const debtRecent = trendPoints.slice(-3).map((point) => point.recoveryDebt);
  const debtPrev = trendPoints.slice(-6, -3).map((point) => point.recoveryDebt);
  const adaptiveRecent = trendPoints.slice(-3).map((point) => point.adaptiveCapacity);
  const adaptivePrev = trendPoints.slice(-6, -3).map((point) => point.adaptiveCapacity);
  const riskTrendDelta =
    riskRecent.length > 0
      ? average(riskRecent) - (riskPrev.length > 0 ? average(riskPrev) : riskRecent[0] ?? average(riskRecent))
      : 0;
  const debtTrendDelta =
    debtRecent.length > 0
      ? average(debtRecent) - (debtPrev.length > 0 ? average(debtPrev) : debtRecent[0] ?? average(debtRecent))
      : 0;
  const adaptiveTrendDelta =
    adaptiveRecent.length > 0
      ? average(adaptiveRecent) - (adaptivePrev.length > 0 ? average(adaptivePrev) : adaptiveRecent[0] ?? average(adaptiveRecent))
      : 0;

  const riskTrendScore = clamp((-riskTrendDelta + 1.5) / 8, 0, 1);
  const debtTrendScore = clamp((-debtTrendDelta + 1.5) / 8, 0, 1);
  const adaptiveTrendScore = clamp((adaptiveTrendDelta + 1.5) / 8, 0, 1);
  const trendScore = average([riskTrendScore, debtTrendScore, adaptiveTrendScore]);
  const historyQuality = trailingSignalRatios.length > 0 ? average(trailingSignalRatios) : 0;
  const qualityScore = clamp(historyQuality * 0.65 + currentAssessment.signalRatio * 0.35, 0, 1);
  const streakScore = clamp(streakDays / 6, 0, 1);
  const sustainedCoverageScore = clamp(sustainedDimensionCount / 6, 0, 1);
  const sustainedBonus = sustainedImprovementDetected ? 0.12 + Math.min(0.14, Math.max(0, streakDays - 3) * 0.025) : 0;
  const rawStrength = clamp(
    streakScore * 0.42 + qualityScore * 0.24 + trendScore * 0.16 + sustainedCoverageScore * 0.18 + sustainedBonus,
    0,
    1
  );
  const strength =
    streakDays >= 3 || sustainedImprovementDetected
      ? clamp(Math.max(rawStrength, 0.52), 0, 1)
      : streakDays >= 2
        ? clamp(Math.max(rawStrength, 0.35), 0, 1)
        : rawStrength;
  const reasons = uniqueStrings([
    ...trailingReasons,
    ...(currentAssessment.positive ? currentAssessment.reasons : []),
    ...(riskTrendDelta <= 0 ? ["risk_slope_flat_or_down"] : []),
    ...(debtTrendDelta <= 0 ? ["recovery_debt_stabilizing"] : []),
    ...(adaptiveTrendDelta >= 0 ? ["adaptive_capacity_recovering"] : []),
    ...(sleepDurationStreak >= 3 ? [`sleep_duration_streak_${sleepDurationStreak}`] : []),
    ...(sleepQualityStreak >= 3 ? [`sleep_quality_streak_${sleepQualityStreak}`] : []),
    ...(stressReliefStreak >= 3 ? [`stress_relief_streak_${stressReliefStreak}`] : []),
    ...(deepWorkReliefStreak >= 3 ? [`load_relief_streak_${deepWorkReliefStreak}`] : []),
    ...(circadianStreak >= 3 ? [`circadian_streak_${circadianStreak}`] : []),
    ...(movementReturnStreak >= 2 ? [`movement_return_streak_${movementReturnStreak}`] : []),
    ...(sustainedImprovementDetected ? [`sustained_improvement_dims_${sustainedDimensionCount}`] : []),
  ]).slice(0, 8);

  return {
    streakDays,
    strength,
    reasons,
  };
}

function buildAutoAntiChaosActionItems(input: {
  severity: "warning" | "critical";
  load: number;
  recovery: number;
  recoveryDebt: number;
}): string[] {
  const critical = input.severity === "critical";
  const deepWorkCap = critical ? 60 : 90;
  const loadImbalance = input.load - input.recovery;
  const expectedEffects = critical
    ? { Energy: 7, Focus: 4, risk: -0.26 }
    : { Energy: 5, Focus: 3, risk: -0.16 };
  const mainPriority = critical
    ? "Contain active instability cascade and enforce recovery-first mode"
    : "Stabilize degradation trend before cascade escalation";
  const secondaryOne =
    loadImbalance >= 10
      ? `Cap deep work to ${deepWorkCap} minutes and eliminate context switching loops`
      : `Keep deep work within ${deepWorkCap} minutes and run low-variance schedule blocks`;
  const secondaryTwo =
    input.recoveryDebt >= 68
      ? "Protect sleep anchor immediately and remove late-day cognitive load"
      : "Freeze optional commitments until risk slope and burnout slope flatten";
  const mandatoryRecovery = critical
    ? "Two recovery blocks (20m + 30m), hydration protocol, no caffeine after 12:00"
    : "One 30m decompression block, daylight walk, no caffeine after 14:00";
  const cutList = critical
    ? ["High-intensity training", "Late deep work", "Parallel projects", "Reactive communication loops"]
    : ["Late deep work", "Optional meetings", "Reactive multitasking", "Low-impact backlog churn"];

  return [
    `SOURCE|${AUTO_ANTI_CHAOS_REASON}`,
    `SEVERITY|${critical ? "CRITICAL" : "WARNING"}`,
    `MAIN|${mainPriority}`,
    `SECONDARY|${secondaryOne}`,
    `SECONDARY|${secondaryTwo}`,
    `MANDATORY_RECOVERY|${mandatoryRecovery}`,
    ...cutList.map((line) => `CUT|${line}`),
    `EXPECTED_EFFECTS|${JSON.stringify(expectedEffects)}`,
  ];
}

function resolveAutoAntiChaosPlan(input: {
  guardrail: "OPEN" | "CAUTION" | "LOCKDOWN";
  currentRisk: number;
  avgRisk14d: number;
  burnout: number;
  recoveryDebt: number;
  adaptiveCapacity: number;
  overloadLevel: number;
  lifeScoreTrend: number;
  riskDelta7d: number;
  burnoutDelta7d: number;
  load: number;
  recovery: number;
  highRiskStreak: number;
  highBurnoutStreak: number;
  overloadStreak: number;
  failedRecoveryStreak: number;
  recoveryPatternStreakDays?: number;
  recoveryPatternStrength?: number;
}): {
  shouldActivate: boolean;
  systemStatus: SystemStatus;
  reasons: string[];
  actionItems: string[];
} {
  const reasons: string[] = [AUTO_ANTI_CHAOS_REASON];
  let cascadeScore = 0;
  let recoveryReliefScore = 0;

  const addSignal = (score: number, reason: string) => {
    cascadeScore += score;
    reasons.push(reason);
  };
  const addRecoveryRelief = (score: number, reason: string) => {
    recoveryReliefScore += score;
    reasons.push(reason);
  };

  const recoveryPatternStreakDays = Math.max(0, Math.round(input.recoveryPatternStreakDays ?? 0));
  const recoveryPatternStrength = clamp(input.recoveryPatternStrength ?? 0, 0, 1);

  if (input.guardrail === "LOCKDOWN") {
    addSignal(3, "guardrail_lockdown");
  } else if (input.guardrail === "CAUTION") {
    addSignal(1, "guardrail_caution");
  }

  if (input.currentRisk >= 80) {
    addSignal(3, "risk_80_plus");
  } else if (input.currentRisk >= 72) {
    addSignal(2, "risk_72_plus");
  } else if (input.currentRisk >= 66) {
    addSignal(1, "risk_66_plus");
  }

  if (input.avgRisk14d >= 72) {
    addSignal(2, "risk14d_72_plus");
  } else if (input.avgRisk14d >= 64) {
    addSignal(1, "risk14d_64_plus");
  }

  if (input.burnout >= 78) {
    addSignal(3, "burnout_78_plus");
  } else if (input.burnout >= 70) {
    addSignal(2, "burnout_70_plus");
  } else if (input.burnout >= 64) {
    addSignal(1, "burnout_64_plus");
  }

  if (input.recoveryDebt >= 78) {
    addSignal(3, "recovery_debt_78_plus");
  } else if (input.recoveryDebt >= 70) {
    addSignal(2, "recovery_debt_70_plus");
  } else if (input.recoveryDebt >= 62) {
    addSignal(1, "recovery_debt_62_plus");
  }

  if (input.adaptiveCapacity <= 30) {
    addSignal(3, "adaptive_capacity_30_minus");
  } else if (input.adaptiveCapacity <= 38) {
    addSignal(2, "adaptive_capacity_38_minus");
  } else if (input.adaptiveCapacity <= 45) {
    addSignal(1, "adaptive_capacity_45_minus");
  }

  if (input.overloadLevel >= 2) {
    addSignal(2, "overload_level_2");
  } else if (input.overloadLevel >= 1) {
    addSignal(1, "overload_level_1");
  }

  const loadRecoveryGap = input.load - input.recovery;
  if (loadRecoveryGap >= 16) {
    addSignal(2, "load_recovery_gap_16_plus");
  } else if (loadRecoveryGap >= 10) {
    addSignal(1, "load_recovery_gap_10_plus");
  }

  if (input.lifeScoreTrend <= -8) {
    addSignal(2, "life_score_trend_minus_8");
  } else if (input.lifeScoreTrend <= -5) {
    addSignal(1, "life_score_trend_minus_5");
  }

  if (input.riskDelta7d >= 12) {
    addSignal(2, "risk_delta7d_12_plus");
  } else if (input.riskDelta7d >= 8) {
    addSignal(1, "risk_delta7d_8_plus");
  }

  if (input.burnoutDelta7d >= 10) {
    addSignal(2, "burnout_delta7d_10_plus");
  } else if (input.burnoutDelta7d >= 6) {
    addSignal(1, "burnout_delta7d_6_plus");
  }

  if (input.highRiskStreak >= 3) {
    addSignal(2, "high_risk_streak_3");
  } else if (input.highRiskStreak >= 2) {
    addSignal(1, "high_risk_streak_2");
  }

  if (input.highBurnoutStreak >= 3) {
    addSignal(2, "high_burnout_streak_3");
  } else if (input.highBurnoutStreak >= 2) {
    addSignal(1, "high_burnout_streak_2");
  }

  if (input.overloadStreak >= 3) {
    addSignal(2, "overload_streak_3");
  } else if (input.overloadStreak >= 2) {
    addSignal(1, "overload_streak_2");
  }

  if (input.failedRecoveryStreak >= 3) {
    addSignal(2, "failed_recovery_streak_3");
  } else if (input.failedRecoveryStreak >= 2) {
    addSignal(1, "failed_recovery_streak_2");
  }

  const persistentSignals =
    (input.highRiskStreak >= 2 ? 1 : 0) +
    (input.highBurnoutStreak >= 2 ? 1 : 0) +
    (input.failedRecoveryStreak >= 2 ? 1 : 0) +
    (input.overloadStreak >= 2 ? 1 : 0) +
    (input.lifeScoreTrend <= -5 ? 1 : 0) +
    (input.riskDelta7d >= 8 ? 1 : 0) +
    (input.burnoutDelta7d >= 6 ? 1 : 0);

  if (recoveryPatternStreakDays >= 3 && recoveryPatternStrength >= 0.5) {
    addRecoveryRelief(2, `recovery_pattern_3d (${recoveryPatternStreakDays}d @ ${recoveryPatternStrength.toFixed(2)})`);
  }
  if (recoveryPatternStreakDays >= 5 && recoveryPatternStrength >= 0.6) {
    addRecoveryRelief(2, `recovery_pattern_5d (${recoveryPatternStreakDays}d @ ${recoveryPatternStrength.toFixed(2)})`);
  }
  if (input.riskDelta7d <= -4) {
    addRecoveryRelief(1, `risk_delta7d_down (${input.riskDelta7d.toFixed(1)})`);
  }
  if (input.burnoutDelta7d <= -4) {
    addRecoveryRelief(1, `burnout_delta7d_down (${input.burnoutDelta7d.toFixed(1)})`);
  }
  if (input.lifeScoreTrend >= 2) {
    addRecoveryRelief(1, `life_score_trend_up (${input.lifeScoreTrend.toFixed(1)})`);
  }
  if (input.recovery >= input.load + 4) {
    addRecoveryRelief(1, `recovery_minus_load>=4 (${(input.recovery - input.load).toFixed(1)})`);
  }

  const cascadeScoreAfterRelief = Math.max(0, cascadeScore - recoveryReliefScore);
  const strongRecoveryRelief = recoveryReliefScore >= 4 && recoveryPatternStreakDays >= 4;

  const emergency =
    (input.guardrail === "LOCKDOWN" && (input.currentRisk >= 74 || input.burnout >= 72 || input.recoveryDebt >= 70)) ||
    (input.currentRisk >= 82 && input.burnout >= 76) ||
    (input.recoveryDebt >= 80 && input.adaptiveCapacity <= 32) ||
    (input.highRiskStreak >= 3 && input.failedRecoveryStreak >= 2 && input.adaptiveCapacity <= 38);

  const shouldActivate =
    emergency ||
    cascadeScoreAfterRelief >= 11 ||
    (cascadeScoreAfterRelief >= 8 && persistentSignals >= 2 && !strongRecoveryRelief);
  if (!shouldActivate) {
    return {
      shouldActivate: false,
      systemStatus: SystemStatus.STABLE,
      reasons: [],
      actionItems: [],
    };
  }

  const critical =
    emergency ||
    cascadeScoreAfterRelief >= 13 ||
    (input.guardrail === "LOCKDOWN" && cascadeScoreAfterRelief >= 10 && !strongRecoveryRelief) ||
    (input.failedRecoveryStreak >= 3 && input.highRiskStreak >= 3);
  const systemStatus = critical ? SystemStatus.CRITICAL : SystemStatus.WARNING;
  const actionItems = buildAutoAntiChaosActionItems({
    severity: critical ? "critical" : "warning",
    load: input.load,
    recovery: input.recovery,
    recoveryDebt: input.recoveryDebt,
  });

  return {
    shouldActivate: true,
    systemStatus,
    reasons: uniqueStrings([AUTO_ANTI_CHAOS_REASON, `Severity:${critical ? "CRITICAL" : "WARNING"}`, ...reasons]).slice(0, 8),
    actionItems,
  };
}

function isAutoProtocolInput(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return payload.autoGenerated === true;
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
      plan: true,
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
  const calibrationProfile = await buildCalibrationProfile({
    userId,
    endDate: day,
    windowDays: 30,
  });
  const [historyCheckins, historyBios, protocolCandidatesForControl, unresolvedAntiChaosPlanForControl] = await Promise.all([
    prisma.dailyCheckIn.findMany({
      where: {
        userId,
        date: {
          gte: dayMinus13,
          lt: day,
        },
      },
      orderBy: { date: "asc" },
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
      orderBy: { date: "asc" },
      select: {
        date: true,
        energyReserve: true,
        cognitiveFatigue: true,
        strainIndex: true,
        overloadLevel: true,
        recoveryDebt: true,
        adaptiveCapacity: true,
        circadianAlignment: true,
        stressLoad: true,
        burnoutRiskIndex: true,
        resilienceIndex: true,
      },
    }),
    prisma.protocolRun.findMany({
      where: {
        userId,
        appliedAt: { not: null, lt: day },
      },
      orderBy: { appliedAt: "desc" },
      take: 12,
      select: {
        appliedAt: true,
        horizonHours: true,
        mode: true,
      },
    }),
    prisma.antiChaosPlan.findFirst({
      where: {
        userId,
        isResolved: false,
        date: { lt: day },
      },
      orderBy: { date: "desc" },
      select: {
        date: true,
        systemStatus: true,
      },
    }),
  ]);
  const historicalCheckinByDate = new Map(
    historyCheckins.map((row) => [startOfDay(row.date).toISOString(), row] as const)
  );
  const historicalRisks = historyBios.map((bio) => {
    const key = startOfDay(bio.date).toISOString();
    const row = historicalCheckinByDate.get(key);
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
  const recoveryPatternForControl = resolveRecoveryPatternForControl({
    day,
    currentDaily,
    currentCircadianAlignment: clamp(100 - circadianAlignmentPenalty, 0, 100),
    prevBioState: prevBioState
      ? {
          energyReserve: prevBioState.energyReserve,
          cognitiveFatigue: prevBioState.cognitiveFatigue,
          strainIndex: prevBioState.strainIndex,
          overloadLevel: prevBioState.overloadLevel,
          circadianAlignment: prevBioState.circadianAlignment,
          stressLoad: prevBioState.stressLoad,
        }
      : null,
    historyCheckins,
    historyBios,
  });
  const activeProtocolForControl =
    protocolCandidatesForControl.find((row) => {
      if (!row.appliedAt) return false;
      const expiresAt = row.appliedAt.getTime() + row.horizonHours * 60 * 60 * 1000;
      return day.getTime() < expiresAt;
    }) ?? null;
  const antiChaosAgeDays = unresolvedAntiChaosPlanForControl
    ? diffUtcDays(day, unresolvedAntiChaosPlanForControl.date)
    : null;
  const antiChaosForControl =
    unresolvedAntiChaosPlanForControl && typeof antiChaosAgeDays === "number" && antiChaosAgeDays <= 10
      ? {
          active: true as const,
          severity: unresolvedAntiChaosPlanForControl.systemStatus === SystemStatus.CRITICAL ? ("CRITICAL" as const) : ("WARNING" as const),
          daysSinceActivation: antiChaosAgeDays,
        }
      : null;
  const controlLayerState =
    activeProtocolForControl || antiChaosForControl || recoveryPatternForControl
      ? {
          protocol: activeProtocolForControl
            ? {
                active: true as const,
                mode: activeProtocolForControl.mode === "STABILIZE" ? ("STABILIZE" as const) : ("STANDARD" as const),
                horizonHours: activeProtocolForControl.horizonHours,
              }
            : undefined,
          antiChaos: antiChaosForControl ?? undefined,
          recoveryPattern: recoveryPatternForControl ?? undefined,
        }
      : undefined;

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
    controlLayer: controlLayerState,
    calibration: calibrationProfile,
  });

  const currentRisk = clamp(result.risk, 0, 100);
  const riskWindow = [...historicalRisks, currentRisk].slice(-14);
  const avgRisk14d = average(riskWindow);
  const recentRiskWindow = riskWindow.slice(-7);
  const previousRiskWindow = riskWindow.slice(-14, -7);
  const riskDelta7d =
    recentRiskWindow.length > 0
      ? average(recentRiskWindow) - (previousRiskWindow.length > 0 ? average(previousRiskWindow) : recentRiskWindow[0] ?? 0)
      : 0;
  const recentBurnoutAnchor =
    historyBios.length >= 7
      ? historyBios[Math.max(0, historyBios.length - 7)]?.burnoutRiskIndex ?? result.nextBioState.burnoutRiskIndex
      : historyBios[historyBios.length - 1]?.burnoutRiskIndex ?? result.nextBioState.burnoutRiskIndex;
  const burnoutDelta7d = result.nextBioState.burnoutRiskIndex - recentBurnoutAnchor;
  const protocolInputs = computeProtocolInputsFromBio({
    energyReserve: result.nextBioState.energyReserve,
    cognitiveFatigue: result.nextBioState.cognitiveFatigue,
    strainIndex: result.nextBioState.strainIndex,
    stressLoad: result.nextBioState.stressLoad,
    burnoutRiskIndex: result.nextBioState.burnoutRiskIndex,
    parasympatheticDrive: result.nextBioState.parasympatheticDrive,
    resilienceIndex: result.nextBioState.resilienceIndex,
  });
  const historicalProtocolSignals = historyBios.map((bio) =>
    computeProtocolInputsFromBio({
      energyReserve: bio.energyReserve,
      cognitiveFatigue: bio.cognitiveFatigue,
      strainIndex: bio.strainIndex,
      stressLoad: bio.stressLoad,
      burnoutRiskIndex: bio.burnoutRiskIndex,
      parasympatheticDrive: 50,
      resilienceIndex: bio.resilienceIndex,
    })
  );
  const riskSeriesForAntiChaos = [...historicalProtocolSignals.map((row) => row.risk), protocolInputs.risk];
  const burnoutSeriesForAntiChaos = [...historyBios.map((row) => row.burnoutRiskIndex), result.nextBioState.burnoutRiskIndex];
  const overloadSeriesForAntiChaos = [...historyBios.map((row) => row.overloadLevel), result.nextBioState.overloadLevel];
  const failedRecoveryFlags = [
    ...historyBios.map((bio, index) => {
      const signal = historicalProtocolSignals[index];
      return bio.recoveryDebt >= 62 && bio.adaptiveCapacity <= 45 && signal.load - signal.recovery >= 6;
    }),
    result.nextBioState.recoveryDebt >= 62 &&
      result.nextBioState.adaptiveCapacity <= 45 &&
      protocolInputs.load - protocolInputs.recovery >= 6,
  ];
  const highRiskStreak = countTrailingTrue(riskSeriesForAntiChaos.map((value) => value >= 68));
  const highBurnoutStreak = countTrailingTrue(burnoutSeriesForAntiChaos.map((value) => value >= 66));
  const overloadStreak = countTrailingTrue(overloadSeriesForAntiChaos.map((value) => value >= 1));
  const failedRecoveryStreak = countTrailingTrue(failedRecoveryFlags);
  const guardrailForProtocol = evaluateGuardrail({
    currentRisk: protocolInputs.risk,
    avgRisk14d: clamp(avgRisk14d + (userAdaptive?.adaptiveRiskOffset ?? 0), 0, 100),
    burnout: result.nextBioState.burnoutRiskIndex,
    confidence: calibrationProfile.confidence,
    adaptiveRiskOffset: userAdaptive?.adaptiveRiskOffset ?? 0,
    recoveryDebt: result.nextBioState.recoveryDebt,
    adaptiveCapacity: result.nextBioState.adaptiveCapacity,
    resilience: result.nextBioState.resilienceIndex,
    overloadLevel: result.nextBioState.overloadLevel,
    lifeScore: result.lifeScore,
    lifeScoreDelta7d: lifeScoreTrend,
    riskDelta7d,
    burnoutDelta7d,
    load: protocolInputs.load,
    recovery: protocolInputs.recovery,
    recoveryPattern: recoveryPatternForControl
      ? {
          streakDays: recoveryPatternForControl.streakDays,
          strength: recoveryPatternForControl.strength,
        }
      : null,
  });
  const autoAntiChaosPlan = resolveAutoAntiChaosPlan({
    guardrail: guardrailForProtocol.label,
    currentRisk: protocolInputs.risk,
    avgRisk14d: clamp(avgRisk14d + (userAdaptive?.adaptiveRiskOffset ?? 0), 0, 100),
    burnout: result.nextBioState.burnoutRiskIndex,
    recoveryDebt: result.nextBioState.recoveryDebt,
    adaptiveCapacity: result.nextBioState.adaptiveCapacity,
    overloadLevel: result.nextBioState.overloadLevel,
    lifeScoreTrend,
    riskDelta7d,
    burnoutDelta7d,
    load: protocolInputs.load,
    recovery: protocolInputs.recovery,
    highRiskStreak,
    highBurnoutStreak,
    overloadStreak,
    failedRecoveryStreak,
    recoveryPatternStreakDays: recoveryPatternForControl?.streakDays ?? 0,
    recoveryPatternStrength: recoveryPatternForControl?.strength ?? 0,
  });
  const baseAutoProtocolPlan = resolveAutoProtocolPlan({
    guardrail: guardrailForProtocol.label,
    userPlan: userAdaptive?.plan,
    currentRisk: protocolInputs.risk,
    burnout: result.nextBioState.burnoutRiskIndex,
    recoveryDebt: result.nextBioState.recoveryDebt,
    adaptiveCapacity: result.nextBioState.adaptiveCapacity,
    lifeScoreTrend,
    riskDelta7d,
    recoveryPatternStreakDays: recoveryPatternForControl?.streakDays ?? 0,
    recoveryPatternStrength: recoveryPatternForControl?.strength ?? 0,
  });
  const autoProtocolPlan = autoAntiChaosPlan.shouldActivate
    ? {
        shouldGenerate: true,
        guardrailState: guardrailForProtocol.label === "LOCKDOWN" ? ("LOCKDOWN" as const) : ("CAUTION" as const),
        mode: "STABILIZE" as const,
        horizonHours: autoAntiChaosPlan.systemStatus === SystemStatus.CRITICAL ? (72 as const) : (48 as const),
        triggerReasons: uniqueStrings([...baseAutoProtocolPlan.triggerReasons, "anti_chaos_auto"]),
      }
    : baseAutoProtocolPlan;
  let adaptiveRiskOffset = userAdaptive?.adaptiveRiskOffset ?? 0;
  let adaptiveRecoveryOffset = userAdaptive?.adaptiveRecoveryOffset ?? 0;
  const sustainedRecoveryForOffsets = Boolean(
    recoveryPatternForControl &&
      recoveryPatternForControl.streakDays >= 4 &&
      recoveryPatternForControl.strength >= 0.58 &&
      riskDelta7d <= -3 &&
      burnoutDelta7d <= -2 &&
      lifeScoreTrend >= 1
  );
  if (avgRisk14d > 75 && !sustainedRecoveryForOffsets) {
    adaptiveRiskOffset += 0.4;
    adaptiveRecoveryOffset -= 0.3;
  } else if (avgRisk14d < 45) {
    adaptiveRiskOffset -= 0.3;
    adaptiveRecoveryOffset += 0.4;
  }
  if (sustainedRecoveryForOffsets) {
    const reboundStep = guardrailForProtocol.label === "LOCKDOWN" ? 0.35 : 0.55;
    adaptiveRiskOffset -= reboundStep;
    adaptiveRecoveryOffset += reboundStep;
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

    const sameDayAntiChaosPlan = await tx.antiChaosPlan.findUnique({
      where: { userId_date: { userId, date: day } },
      select: {
        id: true,
        reasons: true,
        isResolved: true,
      },
    });
    const sameDayAutoAntiChaos =
      sameDayAntiChaosPlan?.reasons?.includes(AUTO_ANTI_CHAOS_REASON) ?? false;

    if (autoAntiChaosPlan.shouldActivate) {
      if (!sameDayAntiChaosPlan) {
        await tx.antiChaosPlan.create({
          data: {
            userId,
            date: day,
            systemStatus: autoAntiChaosPlan.systemStatus,
            reasons: autoAntiChaosPlan.reasons,
            actionItems: autoAntiChaosPlan.actionItems,
            isResolved: false,
            resolvedDate: null,
          },
        });
      } else if (sameDayAutoAntiChaos) {
        await tx.antiChaosPlan.update({
          where: { id: sameDayAntiChaosPlan.id },
          data: {
            systemStatus: autoAntiChaosPlan.systemStatus,
            reasons: autoAntiChaosPlan.reasons,
            actionItems: autoAntiChaosPlan.actionItems,
            isResolved: false,
            resolvedDate: null,
          },
        });
      }
    } else {
      await tx.antiChaosPlan.updateMany({
        where: {
          userId,
          isResolved: false,
          date: { lte: day },
          reasons: {
            has: AUTO_ANTI_CHAOS_REASON,
          },
        },
        data: {
          isResolved: true,
          resolvedDate: day,
        },
      });
    }

    if (autoProtocolPlan.shouldGenerate) {
      const protocolPayload = buildProtocol({
        guardrailState: autoProtocolPlan.guardrailState,
        mode: autoProtocolPlan.mode,
        risk: protocolInputs.risk,
        recovery: protocolInputs.recovery,
        load: protocolInputs.load,
        confidence: calibrationProfile.confidence,
        horizonHours: autoProtocolPlan.horizonHours,
      });
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCHours(23, 59, 59, 999);
      const applyAt = new Date(dayStart);
      applyAt.setUTCHours(12, 0, 0, 0);

      const sameDayRuns = await tx.protocolRun.findMany({
        where: {
          userId,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          inputs: true,
        },
      });
      const sameDayAutoRuns = sameDayRuns.filter((row) => isAutoProtocolInput(row.inputs));
      const sameDayAutoRun = sameDayAutoRuns[0] ?? null;
      const runPayload = {
        load: protocolInputs.load,
        recovery: protocolInputs.recovery,
        risk: protocolInputs.risk,
        burnout: protocolInputs.burnout,
        avgRisk14d: Math.round(avgRisk14d * 10) / 10,
        confidence: Math.round(calibrationProfile.confidence * 1000) / 1000,
        autoGenerated: true,
        source: "recalculate_day",
        triggerDate: dayStart.toISOString().slice(0, 10),
        triggerReasons: autoProtocolPlan.triggerReasons,
        guardrailPressureReasons: guardrailForProtocol.reasons,
      };

      if (sameDayAutoRun) {
        await tx.protocolRun.update({
          where: { id: sameDayAutoRun.id },
          data: {
            horizonHours: autoProtocolPlan.horizonHours,
            mode: autoProtocolPlan.mode,
            guardrailState: autoProtocolPlan.guardrailState,
            confidence: calibrationProfile.confidence,
            inputs: runPayload,
            protocol: protocolPayload,
            appliedAt: applyAt,
          },
        });
        const duplicateAutoRunIds = sameDayAutoRuns.slice(1).map((row) => row.id);
        if (duplicateAutoRunIds.length > 0) {
          await tx.protocolRun.deleteMany({
            where: {
              id: { in: duplicateAutoRunIds },
            },
          });
        }
      } else {
        await tx.protocolRun.create({
          data: {
            userId,
            createdAt: applyAt,
            appliedAt: applyAt,
            horizonHours: autoProtocolPlan.horizonHours,
            mode: autoProtocolPlan.mode,
            guardrailState: autoProtocolPlan.guardrailState,
            confidence: calibrationProfile.confidence,
            inputs: runPayload,
            protocol: protocolPayload,
          },
        });
      }
    } else {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCHours(23, 59, 59, 999);
      const sameDayRuns = await tx.protocolRun.findMany({
        where: {
          userId,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          inputs: true,
        },
      });
      const sameDayAutoRuns = sameDayRuns.filter((row) => isAutoProtocolInput(row.inputs));
      if (sameDayAutoRuns.length > 0) {
        const sameDayAutoRunIds = sameDayAutoRuns.map((row) => row.id);
        await tx.protocolRun.updateMany({
          where: { id: { in: sameDayAutoRunIds } },
          data: {
            appliedAt: null,
            outcome: {
              autoCleared: true,
              reason: "stability_recovered_same_day",
              guardrail: guardrailForProtocol.label,
            },
          },
        });
      }
    }

    return {
      snapshotId: snapshot.id,
      adaptiveRiskOffset,
      adaptiveRecoveryOffset,
      ...result,
    };
  });
}
