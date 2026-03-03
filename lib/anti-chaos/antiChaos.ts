import { prisma } from "@/lib/prisma";
import { ensureUserWithPlan } from "@/lib/api/plan";
import { toUtcDateOnly } from "@/lib/api/date";
import { ApiError } from "@/lib/api/errors";
import { buildCalibrationProfile } from "@/lib/calibration/personalCalibration";
import { buildWeightConfig } from "@/lib/services/recalculateDay";
import { detectPatterns } from "@/lib/patterns/patternDetection";
import type { PreviousBioStateInput, PreviousSnapshotInput } from "@/lib/scoring/types";
import { simulateForward30d, type ProjectionAvgInputs } from "@/lib/projection/simulateForward30d";
import type {
  AntiChaosActions,
  AntiChaosHorizonHours,
  AntiChaosPatternSignal,
  AntiChaosProtocol,
  AntiChaosSeriesPoint,
  AntiChaosSystemMode,
  TrainingMode,
} from "@/lib/anti-chaos/antiChaos.types";

type CandidateEvaluation = {
  actions: AntiChaosActions;
  score: number;
  baselineEnd: AntiChaosSeriesPoint;
  protocolEnd: AntiChaosSeriesPoint;
  baselineSeries: AntiChaosSeriesPoint[];
  protocolSeries: AntiChaosSeriesPoint[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function circularDistanceMinutes(a: number, b: number): number {
  const diff = Math.abs(a - b) % 1440;
  return Math.min(diff, 1440 - diff);
}

function circularMeanMinutes(values: number[]): number {
  if (values.length === 0) return 0;
  const radians = values.map((value) => (value / 1440) * Math.PI * 2);
  const sin = radians.reduce((sum, value) => sum + Math.sin(value), 0) / values.length;
  const cos = radians.reduce((sum, value) => sum + Math.cos(value), 0) / values.length;
  const angle = Math.atan2(sin, cos);
  const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
  return (normalized / (Math.PI * 2)) * 1440;
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
      circadianAlignmentPenalty: 0,
      regularityPenalty: 0,
    };
  }

  const sum = checkins.reduce(
    (acc, item) => {
      const parsed = parseCheckinMetrics(item.notes);
      acc.sleepHours += parsed.sleepHours ?? 0;
      acc.sleepQuality += parsed.sleepQuality ?? 0;
      acc.bedtimeMinutes +=
        item.bedtimeMinutes ??
        (typeof parsed.bedtimeMinutes === "number" && Number.isFinite(parsed.bedtimeMinutes)
          ? parsed.bedtimeMinutes
          : 23 * 60 + 30);
      acc.wakeTimeMinutes +=
        item.wakeTimeMinutes ??
        (typeof parsed.wakeTimeMinutes === "number" && Number.isFinite(parsed.wakeTimeMinutes)
          ? parsed.wakeTimeMinutes
          : 7 * 60 + 30);
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
  const wakeSeries = checkins.map((item) => {
    const parsed = parseCheckinMetrics(item.notes);
    return (
      item.wakeTimeMinutes ??
      (typeof parsed.wakeTimeMinutes === "number" && Number.isFinite(parsed.wakeTimeMinutes)
        ? parsed.wakeTimeMinutes
        : 7 * 60 + 30)
    );
  });
  const wakeMean = circularMeanMinutes(wakeSeries);
  const wakeDeviation = wakeSeries.reduce((acc, value) => acc + circularDistanceMinutes(value, wakeMean), 0) / n;
  const wakeVariance =
    wakeSeries.reduce((acc, value) => acc + circularDistanceMinutes(value, wakeMean) ** 2, 0) / n;
  const wakeStd = Math.sqrt(wakeVariance);
  const t0 = 30;
  const t1 = 90;
  const maxP = 12;
  const x = clamp((wakeDeviation - t0) / (t1 - t0), 0, 1);
  const soft = x ** 2;
  const tail = clamp((wakeDeviation - t1) / 120, 0, 1);
  const circadianPenalty = maxP * (0.35 * soft + 0.65 * tail);
  const regularityPenalty = 6 * clamp((wakeStd / 60 - 0.3) / 1.2, 0, 1);
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
    circadianAlignmentPenalty: circadianPenalty,
    regularityPenalty,
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

function applyActions(avgInputs: ProjectionAvgInputs, actions: AntiChaosActions): ProjectionAvgInputs {
  const workoutRate =
    actions.trainingMode === "off"
      ? 0
      : actions.trainingMode === "light"
        ? Math.min(avgInputs.workoutRate, 0.33)
        : avgInputs.workoutRate;

  const deepWorkMinutes =
    actions.deepWorkCapMin === 0 ? avgInputs.deepWorkMinutes : Math.min(avgInputs.deepWorkMinutes, actions.deepWorkCapMin);

  const circadianPenaltyNow = clamp(avgInputs.circadianAlignmentPenalty ?? 0, 0, 12);
  const shiftedCircadianPenalty = clamp(circadianPenaltyNow + actions.wakeAnchorShiftMin * 0.08, 0, 12);

  return {
    ...avgInputs,
    sleepHours: clamp(avgInputs.sleepHours + actions.sleepDeltaMin / 60, 4.5, 9.5),
    wakeTimeMinutes:
      typeof avgInputs.wakeTimeMinutes === "number"
        ? ((Math.round(avgInputs.wakeTimeMinutes + actions.wakeAnchorShiftMin) % 1440) + 1440) % 1440
        : undefined,
    bedtimeMinutes:
      typeof avgInputs.bedtimeMinutes === "number"
        ? ((Math.round(avgInputs.bedtimeMinutes + actions.wakeAnchorShiftMin) % 1440) + 1440) % 1440
        : undefined,
    circadianAlignmentPenalty: shiftedCircadianPenalty,
    regularityPenalty: clamp(avgInputs.regularityPenalty ?? 0, 0, 6),
    deepWorkMinutes: clamp(deepWorkMinutes, 0, 360),
    stressLevel: clamp(avgInputs.stressLevel + actions.stressDelta, 1, 10),
    workoutRate: clamp(workoutRate, 0, 1),
  };
}

function buildCandidateGrid(enableWakeShift: boolean): AntiChaosActions[] {
  const sleepDeltaMin: Array<0 | 30 | 60 | 90> = [0, 30, 60, 90];
  const deepWorkCapMin: Array<0 | 30 | 60 | 90> = [0, 30, 60, 90];
  const stressDelta: Array<0 | -1 | -2> = [0, -1, -2];
  const wakeAnchorShiftMin: Array<0 | -30 | -60> = enableWakeShift ? [0, -30, -60] : [0];
  const trainingMode: TrainingMode[] = ["off", "light", "normal"];
  const all: AntiChaosActions[] = [];
  for (const sleepDelta of sleepDeltaMin) {
    for (const deepWorkCap of deepWorkCapMin) {
      for (const stress of stressDelta) {
        for (const wakeShift of wakeAnchorShiftMin) {
          for (const training of trainingMode) {
            all.push({
              sleepDeltaMin: sleepDelta,
              deepWorkCapMin: deepWorkCap,
              stressDelta: stress,
              wakeAnchorShiftMin: wakeShift,
              trainingMode: training,
            });
          }
        }
      }
    }
  }
  return all;
}

function actionCost(actions: AntiChaosActions): number {
  const sleep = (actions.sleepDeltaMin / 30) * 1.2;
  const deepWork = ((90 - actions.deepWorkCapMin) / 30) * 0.8;
  const stress = Math.abs(actions.stressDelta) * 1.0;
  const wakeShift = Math.abs(actions.wakeAnchorShiftMin / 30) * 1.4;
  const training = actions.trainingMode === "normal" ? 0.0 : actions.trainingMode === "light" ? 0.1 : 0.2;
  return sleep + deepWork + stress + wakeShift + training;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function meanAbsDelta(values: number[]): number {
  if (values.length < 2) return 0;
  let total = 0;
  for (let idx = 1; idx < values.length; idx += 1) {
    total += Math.abs(values[idx] - values[idx - 1]);
  }
  return total / (values.length - 1);
}

function maxPositiveSpike(values: number[]): number {
  if (values.length < 2) return 0;
  let maxSpike = 0;
  for (let idx = 1; idx < values.length; idx += 1) {
    const spike = values[idx] - values[idx - 1];
    if (spike > maxSpike) maxSpike = spike;
  }
  return maxSpike;
}

function modeAdjustedScore(params: {
  baseScore: number;
  systemMode: AntiChaosSystemMode;
  protocolSeries7d: AntiChaosSeriesPoint[];
  protocolEnd: AntiChaosSeriesPoint;
  actions: AntiChaosActions;
}): number {
  let score = params.baseScore;
  const riskSeries = params.protocolSeries7d.map((point) => point.risk);
  const stressSeries = params.protocolSeries7d.map((point) => point.stressLevel);
  const strainSeries = params.protocolSeries7d.map((point) => point.strain);
  const volatilityPenalty = stddev(riskSeries);
  const stressDeltaPenalty = meanAbsDelta(stressSeries);
  const strainSpikePenalty = maxPositiveSpike(strainSeries);

  if (params.systemMode === "cycle") {
    score += 1.4 * volatilityPenalty;
    score += 0.6 * stressDeltaPenalty;
    score += 0.9 * Math.max(0, strainSpikePenalty - 2);
  } else if (params.systemMode === "drift") {
    score += 1.2 * params.protocolEnd.recoveryDebt;
    score += 1.0 * params.protocolEnd.circadianPenalty;
  } else if (params.systemMode === "overload") {
    score += 1.8 * params.protocolEnd.burnoutRisk;
    score += 1.5 * params.protocolEnd.strain;
    if (params.actions.trainingMode === "normal") score += 8;
  }

  return score;
}

function leverBiasScore(params: {
  score: number;
  topPatterns: AntiChaosPatternSignal[];
  protocolEnd: AntiChaosSeriesPoint;
}): number {
  let score = params.score;
  for (const pattern of params.topPatterns) {
    if (pattern.severity < 2) continue;
    if (pattern.suggestedLever === "sleep_anchor") {
      score += 0.8 * params.protocolEnd.circadianPenalty;
    } else if (pattern.suggestedLever === "workload_cap") {
      score += 0.8 * params.protocolEnd.strain;
    } else if (pattern.suggestedLever === "recovery_block") {
      score += 0.8 * params.protocolEnd.recoveryDebt;
    } else if (pattern.suggestedLever === "stress_cap") {
      score += 0.8 * params.protocolEnd.stressLevel;
    }
  }
  return score;
}

function scoreCandidate(
  baseEnd: AntiChaosSeriesPoint,
  protocolSeries7d: AntiChaosSeriesPoint[],
  end: AntiChaosSeriesPoint,
  actions: AntiChaosActions,
  circadianAlignmentPenaltyEnd: number,
  regularityPenaltyEnd: number,
  systemMode: AntiChaosSystemMode,
  topPatterns: AntiChaosPatternSignal[]
): number {
  let score = 5.0 * end.risk + 2.5 * end.burnoutRisk - 1.0 * end.lifeScore + actionCost(actions);
  if (circadianAlignmentPenaltyEnd > 0) score += 1.3 * circadianAlignmentPenaltyEnd;
  if (regularityPenaltyEnd > 0) score += 0.8 * regularityPenaltyEnd;
  if (end.risk < 20) score -= 15;
  if (end.burnoutRisk > 60) score += 20;
  if (end.lifeScore < 35) score += 10;
  score = modeAdjustedScore({
    baseScore: score,
    systemMode,
    protocolSeries7d,
    protocolEnd: end,
    actions,
  });
  score = leverBiasScore({
    score,
    topPatterns,
    protocolEnd: end,
  });
  const strainRegressionPenalty = Math.max(0, end.strain - baseEnd.strain) * 0.8;
  return score + strainRegressionPenalty;
}

function detectPattern(end: AntiChaosSeriesPoint): { pattern: string; confidence: number } {
  const pressure = Math.max(end.risk, end.burnoutRisk);
  if (pressure >= 70) return { pattern: "Acute instability", confidence: 0.9 };
  if (end.risk >= 50) return { pattern: "Risk elevation", confidence: 0.78 };
  if (end.burnoutRisk >= 50) return { pattern: "Burnout pressure", confidence: 0.74 };
  if (end.lifeScore < 45) return { pattern: "Performance degradation", confidence: 0.68 };
  return { pattern: "Recovery drift", confidence: 0.62 };
}

function buildWhy(args: {
  baselineEnd: AntiChaosSeriesPoint;
  protocolEnd: AntiChaosSeriesPoint;
  detectedPattern: string;
  wakeAnchorShiftMin: number;
}): { primaryDriver: string; secondaryDriver?: string; summary: string } {
  const deltaRisk = args.protocolEnd.risk - args.baselineEnd.risk;
  const deltaBurnout = args.protocolEnd.burnoutRisk - args.baselineEnd.burnoutRisk;
  const deltaLife = args.protocolEnd.lifeScore - args.baselineEnd.lifeScore;

  if (deltaRisk <= deltaBurnout && deltaRisk < 0) {
    return {
      primaryDriver: "Risk suppression",
      secondaryDriver:
        args.wakeAnchorShiftMin !== 0
          ? "Circadian alignment"
          : deltaBurnout < 0
            ? "Burnout containment"
            : "Load containment",
      summary: `Detected ${args.detectedPattern}. Selected protocol minimizes risk at horizon with bounded intervention cost.`,
    };
  }

  if (deltaBurnout < 0) {
    return {
      primaryDriver: "Burnout containment",
      secondaryDriver:
        args.wakeAnchorShiftMin !== 0
          ? "Circadian alignment"
          : deltaRisk < 0
            ? "Risk suppression"
            : "Recovery preservation",
      summary: `Detected ${args.detectedPattern}. Selected protocol reduces burnout pressure and stabilizes near-term trajectory.`,
    };
  }

  return {
    primaryDriver: "Stability preservation",
    secondaryDriver: deltaLife > 0 ? "Life score support" : undefined,
    summary: `Detected ${args.detectedPattern}. No high-gain path found; protocol selected for minimum expected destabilization.`,
  };
}

function buildBrief(args: {
  actions: AntiChaosActions;
  horizonHours: AntiChaosHorizonHours;
  detectedPattern: string;
  why: { primaryDriver: string; secondaryDriver?: string; summary: string };
  baselineEnd: AntiChaosSeriesPoint;
  protocolEnd: AntiChaosSeriesPoint;
  wakeAnchorMinutes?: number;
}): AntiChaosProtocol["brief"] {
  const mainPriority =
    args.actions.sleepDeltaMin >= 60
      ? "Recovery-first adjustment"
      : args.actions.deepWorkCapMin > 0
        ? "Workload volatility cap"
        : args.actions.stressDelta < 0
          ? "Stress setpoint reduction"
          : "Baseline preservation";

  const secondaryA = `Driver: ${args.detectedPattern}`;
  const secondaryB = `Objective: ${args.why.primaryDriver}${args.why.secondaryDriver ? ` + ${args.why.secondaryDriver}` : ""}`;

  const mandatoryRecovery = `Apply for ${args.horizonHours}h, then recalculate against updated snapshot.`;

  const cutList = [
    args.actions.deepWorkCapMin > 0 ? `Deep work > ${args.actions.deepWorkCapMin}m/day` : "Unbounded deep-work spikes",
    args.actions.trainingMode === "off"
      ? "Training load for horizon window"
      : args.actions.trainingMode === "light"
        ? "High-intensity training"
        : "Training intensity drift",
    args.actions.stressDelta < 0 ? "Stress target overshoot" : "Stress variability",
    ...(args.actions.wakeAnchorShiftMin !== 0 ? ["Wake-time drift from anchor"] : []),
  ];

  return {
    mainPriority,
    secondary: [secondaryA, secondaryB],
    mandatoryRecovery,
    wakeAnchorMinutes:
      typeof args.wakeAnchorMinutes === "number" ? ((Math.round(args.wakeAnchorMinutes) % 1440) + 1440) % 1440 : undefined,
    cutList,
    expectedEffects: {
      Energy: Math.round((args.protocolEnd.energy - args.baselineEnd.energy) * 10) / 10,
      Focus: Math.round((args.protocolEnd.focus - args.baselineEnd.focus) * 10) / 10,
      risk: Math.round((args.protocolEnd.risk - args.baselineEnd.risk) * 10) / 10,
      lifeScore: Math.round((args.protocolEnd.lifeScore - args.baselineEnd.lifeScore) * 10) / 10,
      burnout: Math.round((args.protocolEnd.burnoutRisk - args.baselineEnd.burnoutRisk) * 10) / 10,
    },
  };
}

function asSeriesPoint(day: {
  dateOffset: number;
  lifeScore: number;
  risk: number;
  burnoutRisk: number;
  energy: number;
  focus: number;
  strain: number;
  recoveryDebt: number;
  circadianPenalty: number;
  stressLevel: number;
}): AntiChaosSeriesPoint {
  return {
    dateOffset: day.dateOffset,
    lifeScore: day.lifeScore,
    risk: day.risk,
    burnoutRisk: day.burnoutRisk,
    energy: day.energy,
    focus: day.focus,
    strain: day.strain,
    recoveryDebt: day.recoveryDebt,
    circadianPenalty: day.circadianPenalty,
    stressLevel: day.stressLevel,
  };
}

export async function generateAntiChaosProtocol(params: {
  userId: string;
  dateISO: string;
  horizonHours: AntiChaosHorizonHours;
  patternContext?: {
    systemMode: AntiChaosSystemMode;
    topPatterns: AntiChaosPatternSignal[];
  };
}): Promise<AntiChaosProtocol> {
  const user = await ensureUserWithPlan(params.userId);
  const date = toUtcDateOnly(params.dateISO);
  const horizonDays = clamp(Math.round(params.horizonHours / 24), 1, 3);
  const horizonIndex = horizonDays - 1;

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
  if (!initialStat) throw new ApiError(404, "Snapshot not found for protocol generation.");
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
    select: { stressLevel: true, notes: true, bedtimeMinutes: true, wakeTimeMinutes: true },
  });

  const avgInputs = toProjectionAvgInputs(checkins7d, {
    sleepRegularity: currentBio.sleepRegularity,
    cognitiveSaturation: currentBio.cognitiveSaturation,
  });

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
    seedSalt: "anti-chaos-v52-baseline",
  });

  const baselineSeries = baseline.days.slice(0, horizonDays).map(asSeriesPoint);
  if (baselineSeries.length === 0) throw new ApiError(500, "Baseline horizon simulation failed.");
  const patternResult = params.patternContext
    ? params.patternContext
    : await detectPatterns({
        userId: user.id,
        endDateISO: params.dateISO,
        windowDays: 21,
      });
  const systemMode: AntiChaosSystemMode = patternResult.systemMode;
  const topPatterns: AntiChaosPatternSignal[] = patternResult.topPatterns.map((pattern) => ({
    type: pattern.type,
    severity: pattern.severity,
    confidence: pattern.confidence,
    suggestedLever: pattern.suggestedLever,
  }));

  const circadianPenaltyNow = clamp(avgInputs.circadianAlignmentPenalty ?? 0, 0, 12);
  const riskNow = baseline.days[0]?.risk ?? 0;
  const enableWakeShift = circadianPenaltyNow >= 4 || (riskNow >= 25 && circadianPenaltyNow >= 2);
  const candidates = buildCandidateGrid(enableWakeShift);
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[anti-chaos] circadianPenaltyNow=${circadianPenaltyNow.toFixed(2)} riskNow=${riskNow.toFixed(
        1
      )} wakeShiftEnabled=${String(enableWakeShift)}`
    );
  }
  let best: CandidateEvaluation | null = null;

  for (const actions of candidates) {
    const candidateInputs = applyActions(avgInputs, actions);
    const protocol = simulateForward30d({
      userId: user.id,
      startDate,
      initialBioState: currentBio,
      initialStatsSnapshot: initialSnapshot,
      avgInputs: candidateInputs,
      scenario: "BASELINE",
      config,
      previousSnapshot,
      previousBioState: previousBio,
      previousLifeScores,
      calibration,
      seedSalt: `anti-chaos-v52:${params.horizonHours}:${actions.sleepDeltaMin}:${actions.deepWorkCapMin}:${actions.stressDelta}:${actions.wakeAnchorShiftMin}:${actions.trainingMode}`,
    });

    const protocolSeries = protocol.days.slice(0, horizonDays).map(asSeriesPoint);
    const protocolSeries7d = protocol.days.slice(0, 7).map(asSeriesPoint);
    if (protocolSeries.length < horizonDays) continue;
    const protocolEnd = protocolSeries[horizonIndex];
    const baselineEnd = baselineSeries[horizonIndex];

    const candidate: CandidateEvaluation = {
      actions,
      score: scoreCandidate(
        baselineEnd,
        protocolSeries7d,
        protocolEnd,
        actions,
        clamp(candidateInputs.circadianAlignmentPenalty ?? 0, 0, 12),
        clamp(candidateInputs.regularityPenalty ?? 0, 0, 6),
        systemMode,
        topPatterns
      ),
      baselineEnd,
      protocolEnd,
      baselineSeries,
      protocolSeries,
    };

    if (!best || candidate.score < best.score) {
      best = candidate;
    }
  }

  if (!best) throw new ApiError(500, "Unable to generate deterministic anti-chaos protocol.");

  const detected = detectPattern(best.protocolEnd);
  const why = buildWhy({
    baselineEnd: best.baselineEnd,
    protocolEnd: best.protocolEnd,
    detectedPattern: detected.pattern,
    wakeAnchorShiftMin: best.actions.wakeAnchorShiftMin,
  });
  const brief = buildBrief({
    actions: best.actions,
    horizonHours: params.horizonHours,
    detectedPattern: detected.pattern,
    why,
    baselineEnd: best.baselineEnd,
    protocolEnd: best.protocolEnd,
    wakeAnchorMinutes:
      typeof avgInputs.wakeTimeMinutes === "number"
        ? ((Math.round(avgInputs.wakeTimeMinutes + best.actions.wakeAnchorShiftMin) % 1440) + 1440) % 1440
        : undefined,
  });
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[anti-chaos] chosenWakeShiftMin=${best.actions.wakeAnchorShiftMin} score=${best.score.toFixed(2)}`
    );
  }

  return {
    userId: user.id,
    dateISO: params.dateISO,
    horizonHours: params.horizonHours,
    actions: best.actions,
    impact: {
      baselineAtHorizon: {
        lifeScore: best.baselineEnd.lifeScore,
        risk: best.baselineEnd.risk,
        burnout: best.baselineEnd.burnoutRisk,
      },
      protocolAtHorizon: {
        lifeScore: best.protocolEnd.lifeScore,
        risk: best.protocolEnd.risk,
        burnout: best.protocolEnd.burnoutRisk,
      },
      deltas: {
        lifeScore: Math.round((best.protocolEnd.lifeScore - best.baselineEnd.lifeScore) * 10) / 10,
        risk: Math.round((best.protocolEnd.risk - best.baselineEnd.risk) * 10) / 10,
        burnout: Math.round((best.protocolEnd.burnoutRisk - best.baselineEnd.burnoutRisk) * 10) / 10,
      },
    },
    series: {
      baseline: best.baselineSeries,
      protocol: best.protocolSeries,
      horizonDays,
    },
    why,
    detected,
    patternInfluence: {
      systemMode,
      applied: systemMode !== "stable",
    },
    brief,
  };
}
