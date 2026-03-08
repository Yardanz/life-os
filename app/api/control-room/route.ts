import { NextResponse } from "next/server";
import { SystemStatus } from "@prisma/client";
import { auth } from "@/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { controlRoomQuerySchema } from "@/lib/api/schemas";
import { isAdmin } from "@/lib/authz";
import { formatDateOnly, toUtcDateOnly } from "@/lib/api/date";
import { ensureUserWithPlan, isPro as hasOperator } from "@/lib/api/plan";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { clampTzOffsetMinutes, dayKeyToUtcDate, getDayKeyAtOffset, getRecentDayKeysAtOffset } from "@/lib/date/dayKey";
import { prisma } from "@/lib/prisma";
import { buildCalibrationProfile, summarizeSensitivityLevels } from "@/lib/calibration/personalCalibration";
import { computeConfidence } from "@/lib/confidence/confidenceEngine";
import { evaluateGuardrail } from "@/lib/guardrails/guardrailEngine";
import { detectPatterns, extractSeries } from "@/lib/patterns/patternDetection";
import { computeIntegrity } from "@/lib/engine/systemIntegrity";
import { getActiveProtocol } from "@/lib/protocol/protocolHelpers";
import { computeDayV3 } from "@/lib/scoring/engine";
import { startTiming } from "@/lib/observability/timing";
import type {
  DailyCheckInInput,
  PreviousBioStateInput,
  PreviousSnapshotInput,
  WeightConfigInput,
} from "@/lib/scoring/types";
import { buildWeightConfig, recalculateDay } from "@/lib/services/recalculateDay";

const TELEMETRY_FIELD_COUNT = 9;

type ParsedCheckinMetrics = {
  sleepHours?: number;
  sleepQuality?: number;
  bedtimeMinutes?: number;
  wakeTimeMinutes?: number;
  workout?: number;
  deepWorkMin?: number;
  learningMin?: number;
  moneyDelta?: number;
};

type NormalizedInputs = {
  S: number;
  W: number;
  DW: number;
  L: number;
  M: number;
  T: number;
};

type SystemMetrics = {
  load: number;
  recovery: number;
  risk: number;
};

type DiagnosisFlag =
  | "OVERLOAD"
  | "RECOVERY_DEBT"
  | "STRAIN_ACCUMULATING"
  | "FATIGUE_DOMINANT"
  | "ADAPTIVE_SHRINK"
  | "CIRCADIAN_DRIFT"
  | "STRESS_RESIDUE"
  | "TRAINING_ADAPTATION"
  | "SATURATION"
  | "HOMEOSTATIC_IMBALANCE"
  | "NEGATIVE_MOMENTUM"
  | "SYMPATHETIC_DOMINANCE"
  | "PARASYMPATHETIC_RECOVERY"
  | "HORMETIC_ADAPTATION"
  | "OVERSTRESS"
  | "BURNOUT_SPIRAL"
  | "RESILIENCE_HIGH"
  | "LOW_RESERVE"
  | "STRESS_INTERFERENCE"
  | "STABLE"
  | "STABILIZATION_WINDOW";

type DiagnosisPayload = {
  title: string;
  summary: string;
  bullets: Array<{ label: string; value: string }>;
  flags: DiagnosisFlag[];
};

type BreakdownLine = {
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
};

type BreakdownPayload = {
  energy: BreakdownLine[];
  focus: BreakdownLine[];
  discipline: BreakdownLine[];
  fatigue: BreakdownLine[];
  strain: BreakdownLine[];
  risk: BreakdownLine[];
};

type ScenarioType = "BASELINE" | "STABILIZATION" | "OVERLOAD";

type AverageInputs = {
  sleepHours: number;
  sleepQuality: number;
  workout: 0 | 1;
  deepWorkMin: number;
  learningMin: number;
  moneyDelta: number;
  stress: number;
  sleepRegularity: number;
  cognitiveSaturation: number;
};

type ProjectionPoint = {
  day: number;
  projectedLifeScore: number;
  projectedRisk: number;
  projectedBurnoutRisk: number;
};

type Projection30dPayload = {
  baseline: ProjectionPoint[];
  stabilization: ProjectionPoint[];
  overload: ProjectionPoint[];
};

type ExecutiveSummaryPayload = {
  primaryDriver: string;
  secondaryDriver: string | null;
  stabilityState: string;
  trajectory: string;
  explanation: string;
};

type CalibrationPayload = {
  active: boolean;
  confidence: number;
  sensitivities: Record<
    "sleepEnergy" | "stressFocus" | "workoutStrain" | "circadianRisk" | "debtBurnout",
    "Low" | "Moderate" | "High"
  >;
};

type IntegrityPayload = {
  score: number;
  state: "STABLE" | "DRIFT" | "STRAIN";
  violations: string[];
  hasActiveProtocol: boolean;
};

function toNumber(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value.toString());
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function softSaturate(value: number, limit = 120): number {
  if (value <= limit) return value;
  return limit - (value - limit) * 0.5;
}

function capDisplayImpact(rawImpact: number): number {
  return clamp(rawImpact, -25, 25);
}

function sanitizeBioState(nextBioState: PreviousBioStateInput): PreviousBioStateInput {
  return {
    ...nextBioState,
    overloadLevel: clamp(Math.round(nextBioState.overloadLevel), 0, 2) as 0 | 1 | 2,
    energyReserve: clamp(nextBioState.energyReserve, 0, 100),
    cognitiveFatigue: clamp(nextBioState.cognitiveFatigue, 0, 100),
    strainIndex: clamp(nextBioState.strainIndex, 0, 100),
    recoveryDebt: clamp(nextBioState.recoveryDebt, 0, 100),
    adaptiveCapacity: clamp(nextBioState.adaptiveCapacity, 0, 100),
    sleepBuffer: clamp(nextBioState.sleepBuffer, 0, 100),
    circadianAlignment: clamp(nextBioState.circadianAlignment, 0, 100),
    sleepRegularity: clamp(nextBioState.sleepRegularity, 0, 100),
    stressLoad: clamp(softSaturate(nextBioState.stressLoad, 120), 0, 100),
    trainingBuffer: clamp(nextBioState.trainingBuffer, 0, 100),
    homeostasisBias: clamp(nextBioState.homeostasisBias, 0, 100),
    cognitiveSaturation: clamp(nextBioState.cognitiveSaturation, 0, 100),
    sympatheticDrive: clamp(nextBioState.sympatheticDrive, 0, 100),
    parasympatheticDrive: clamp(nextBioState.parasympatheticDrive, 0, 100),
    autonomicBalance: clamp(nextBioState.autonomicBalance, 0, 100),
    hormeticSignal: clamp(nextBioState.hormeticSignal, 0, 100),
    overstressSignal: clamp(nextBioState.overstressSignal, 0, 100),
    burnoutRiskIndex: clamp(softSaturate(nextBioState.burnoutRiskIndex, 120), 0, 100),
    resilienceIndex: clamp(nextBioState.resilienceIndex, 0, 100),
  };
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function tanh(value: number): number {
  const e2x = Math.exp(2 * value);
  return (e2x - 1) / (e2x + 1);
}

function toPercent(value: number): number {
  return Math.round(clamp(value, 0, 1) * 1000) / 10;
}

function parseCheckinMetrics(notes: string | null): ParsedCheckinMetrics {
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

function parseProtocolConstraints(value: unknown): Array<{ label: string; value: string; severity: "hard" | "soft" }> {
  if (!value || typeof value !== "object") return [];
  const protocol = value as Record<string, unknown>;
  if (!Array.isArray(protocol.constraints)) return [];

  return protocol.constraints
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.label !== "string" || typeof row.value !== "string") return null;
      const severity = row.severity === "hard" ? "hard" : row.severity === "soft" ? "soft" : null;
      if (!severity) return null;
      return { label: row.label, value: row.value, severity };
    })
    .filter((item): item is { label: string; value: string; severity: "hard" | "soft" } => item !== null);
}

function normalizeInputs(stressLevel: number | null | undefined, metrics: ParsedCheckinMetrics): NormalizedInputs {
  const stress = clamp(stressLevel ?? 5, 1, 10);
  const S = clamp((metrics.sleepHours ?? 0) / 8, 0, 1) * clamp((metrics.sleepQuality ?? 0) / 5, 0, 1);
  const W = clamp(metrics.workout ?? 0, 0, 1);
  const DW = clamp((metrics.deepWorkMin ?? 0) / 120, 0, 1);
  const L = clamp((metrics.learningMin ?? 0) / 60, 0, 1);
  const M = tanh((metrics.moneyDelta ?? 0) / 2000);
  const T = clamp(1 - (stress - 1) / 9, 0, 1);
  return { S, W, DW, L, M, T };
}

function deriveRecoveryPatternForGuardrail(input: {
  lifeScoreDelta7d: number;
  riskDelta7d: number;
  burnoutDelta7d: number;
  load: number;
  recovery: number;
  sleepHours: number | null | undefined;
  sleepQuality: number | null | undefined;
  stress: number | null | undefined;
  deepWorkMin: number | null | undefined;
  workout: number | null | undefined;
  circadianAlignment: number;
}): { streakDays: number; strength: number } | null {
  let score = 0;

  if (input.riskDelta7d <= -3) score += 1.6;
  if (input.burnoutDelta7d <= -2) score += 1.2;
  if (input.lifeScoreDelta7d >= 1.5) score += 1;
  if (input.recovery >= input.load + 2) score += 1.2;
  if ((input.sleepHours ?? 0) >= 6.9) score += 0.8;
  if ((input.sleepQuality ?? 0) >= 3.4) score += 0.7;
  if ((input.stress ?? 10) <= 6.1) score += 0.8;
  if ((input.deepWorkMin ?? 180) <= 120) score += 0.7;
  if ((input.workout ?? 0) > 0) score += 0.4;
  if (input.circadianAlignment >= 66) score += 0.6;

  if (score < 4) return null;

  const streakDays = clamp(
    Math.round(
      1 +
        (input.riskDelta7d <= -8 ? 4 : input.riskDelta7d <= -4 ? 3 : input.riskDelta7d <= -2 ? 2 : 1) +
        (input.burnoutDelta7d <= -6 ? 3 : input.burnoutDelta7d <= -3 ? 2 : input.burnoutDelta7d <= -1 ? 1 : 0)
    ),
    1,
    10
  );
  const strength = clamp(score / 8.5, 0, 1);
  if (streakDays < 3 || strength < 0.5) return null;

  return { streakDays, strength };
}

function applyScenario(avgInputs: AverageInputs, scenarioType: ScenarioType): AverageInputs {
  if (scenarioType === "STABILIZATION") {
    return {
      ...avgInputs,
      deepWorkMin: avgInputs.deepWorkMin * 0.8,
      stress: avgInputs.stress * 0.8,
      sleepHours: Math.max(avgInputs.sleepHours, 7.5),
    };
  }
  if (scenarioType === "OVERLOAD") {
    return {
      ...avgInputs,
      deepWorkMin: avgInputs.deepWorkMin * 1.1,
      stress: avgInputs.stress * 1.15,
      sleepHours: avgInputs.sleepHours * 0.95,
    };
  }
  return avgInputs;
}

function simulateForward(params: {
  initialSnapshot: {
    date: Date;
    stats: {
      energy: number;
      focus: number;
      discipline: number;
      finance: number;
      growth: number;
    };
    lifeScore: number;
    bio: PreviousBioStateInput;
  };
  avgInputs: AverageInputs;
  scenarioType: ScenarioType;
  config: WeightConfigInput;
  previousSnapshot?: PreviousSnapshotInput;
  previousBioState?: PreviousBioStateInput;
  previousLifeScores: number[];
  calibration?: {
    calibrationActive: boolean;
    confidence: number;
    multipliers: {
      reserveSleepGain: number;
      focusFromStress: number;
      workoutStrain: number;
      circadianRisk: number;
      debtBurnout: number;
    };
  };
}): ProjectionPoint[] {
  const adjusted = applyScenario(params.avgInputs, params.scenarioType);
  const projection: ProjectionPoint[] = [];

  let previousSnapshot = params.initialSnapshot
    ? {
        date: params.initialSnapshot.date,
        lifeScore: params.initialSnapshot.lifeScore,
        stats: {
          Energy: params.initialSnapshot.stats.energy,
          Focus: params.initialSnapshot.stats.focus,
          Discipline: params.initialSnapshot.stats.discipline,
          Finance: params.initialSnapshot.stats.finance,
          Growth: params.initialSnapshot.stats.growth,
        },
      }
    : params.previousSnapshot;

  let previousPreviousSnapshot = params.previousSnapshot;
  let prevBioState = params.initialSnapshot.bio;
  let prevPrevBioState = params.previousBioState;
  const lifeScores = [...params.previousLifeScores];

  for (let day = 1; day <= 30; day += 1) {
    const projectedDate = new Date(params.initialSnapshot.date);
    projectedDate.setUTCDate(projectedDate.getUTCDate() + day);

    const checkIn: DailyCheckInInput = {
      date: projectedDate,
      sleepHours: clamp(adjusted.sleepHours, 0, 12),
      sleepQuality: clamp(adjusted.sleepQuality, 0, 5),
      workout: clamp(adjusted.workout, 0, 1) as 0 | 1,
      deepWorkMin: Math.max(0, adjusted.deepWorkMin),
      learningMin: Math.max(0, adjusted.learningMin),
      moneyDelta: adjusted.moneyDelta,
      stress: clamp(adjusted.stress, 1, 10),
      sleepRegularity: clamp(adjusted.sleepRegularity, 0, 100),
      cognitiveSaturation: clamp(adjusted.cognitiveSaturation, 0, 100),
    };

    const result = computeDayV3({
      checkIn,
      previousSnapshot,
      previousPreviousSnapshot,
      prevBioState,
      prevPrevBioState,
      config: params.config,
      previousLifeScores: lifeScores.slice(-7),
      calibration: params.calibration,
    });

    projection.push({
      day,
      projectedLifeScore: Math.round(clamp(result.lifeScore, 0, 100) * 10) / 10,
      projectedRisk: Math.round(clamp(result.risk, 0, 100) * 10) / 10,
      projectedBurnoutRisk: Math.round(clamp(result.nextBioState.burnoutRiskIndex, 0, 100) * 10) / 10,
    });

    previousPreviousSnapshot = previousSnapshot;
    previousSnapshot = {
      date: projectedDate,
      stats: {
        Energy: clamp(result.stats.Energy, 0, 100),
        Focus: clamp(result.stats.Focus, 0, 100),
        Discipline: clamp(result.stats.Discipline, 0, 100),
        Finance: clamp(result.stats.Finance, 0, 100),
        Growth: clamp(result.stats.Growth, 0, 100),
      },
      lifeScore: clamp(result.lifeScore, 0, 100),
    };
    prevPrevBioState = prevBioState;
    prevBioState = sanitizeBioState(result.nextBioState);
    lifeScores.push(result.lifeScore);
  }

  return projection;
}

function resolveTelemetryQuality(filledFields: number): "High" | "Medium" | "Low" {
  if (filledFields >= 7) return "High";
  if (filledFields >= 4) return "Medium";
  return "Low";
}

function classifyDriverCategory(label: string): keyof Record<
  | "STRESS"
  | "FATIGUE"
  | "CIRCADIAN"
  | "AUTONOMIC"
  | "HORMESIS"
  | "OVERSTRESS"
  | "BURNOUT"
  | "RECOVERY_DEBT",
  number
> | null {
  const normalized = label.toLowerCase();
  if (normalized.includes("burnout")) return "BURNOUT";
  if (normalized.includes("overstress")) return "OVERSTRESS";
  if (normalized.includes("hormetic")) return "HORMESIS";
  if (normalized.includes("autonomic")) return "AUTONOMIC";
  if (normalized.includes("circadian")) return "CIRCADIAN";
  if (normalized.includes("recovery debt")) return "RECOVERY_DEBT";
  if (normalized.includes("stress")) return "STRESS";
  if (normalized.includes("fatigue") || normalized.includes("workload fatigue")) return "FATIGUE";
  return null;
}

function driverLabel(category: string): string {
  switch (category) {
    case "STRESS":
      return "Stress residue";
    case "FATIGUE":
      return "Cognitive fatigue";
    case "CIRCADIAN":
      return "Circadian drift";
    case "AUTONOMIC":
      return "Autonomic imbalance";
    case "HORMESIS":
      return "Hormetic adaptation";
    case "OVERSTRESS":
      return "Overstress signal";
    case "BURNOUT":
      return "Burnout pressure";
    case "RECOVERY_DEBT":
      return "Recovery debt";
    default:
      return "Mixed drivers";
  }
}

function buildExplanation(primaryDriver: string, stabilityState: string, trajectory: string): string {
  if (primaryDriver === "Burnout pressure") {
    if (stabilityState === "Burnout risk") {
      return "Burnout pressure is dominating system behavior. Reduce load volatility and increase recovery density before pushing performance.";
    }
    return "Burnout pressure is present and should be stabilized early. Keep load controlled and preserve sleep quality.";
  }
  if (primaryDriver === "Stress residue") {
    return "Residual stress is the main destabilizer. Lower pressure loops and protect low-stimulation recovery windows.";
  }
  if (primaryDriver === "Cognitive fatigue") {
    return "Fatigue load is suppressing execution quality. Shorten focus blocks and prioritize restoration over intensity.";
  }
  if (primaryDriver === "Circadian drift") {
    return "Rhythm disruption is reducing recovery efficiency. Stabilize sleep timing and reduce late cognitive load.";
  }
  if (primaryDriver === "Autonomic imbalance") {
    return "Autonomic balance is shifted away from recovery mode. Reduce sympathetic triggers and restore parasympathetic tone.";
  }
  if (primaryDriver === "Overstress signal") {
    return "Overstress signal is outpacing adaptation. Reduce load intensity and allow delayed recovery to catch up.";
  }
  if (primaryDriver === "Recovery debt") {
    return "Recovery debt is constraining resilience and focus. Prioritize sleep depth and lower non-essential strain.";
  }
  if (primaryDriver === "Hormetic adaptation") {
    return stabilityState === "Stable" || trajectory === "Improving"
      ? "Adaptive hormetic load is supporting progression. Keep the challenge-recovery balance consistent."
      : "Hormetic signal is positive, but stability is fragile. Keep adaptation stimulus modest until strain normalizes.";
  }
  return "System state is mixed without a single dominant destabilizer. Maintain balance and monitor trend continuity.";
}

function buildExecutiveSummary(params: {
  snapshot: {
    systemMetrics: { risk: number };
    bio: {
      burnoutRiskIndex: number;
      resilienceIndex: number;
      recoveryDebt: number;
      strainIndex: number;
    };
  };
  breakdown: BreakdownPayload;
  trends: {
    lifeScoreTrend: number;
    burnoutTrend: number;
  };
}): ExecutiveSummaryPayload {
  const { snapshot, breakdown, trends } = params;
  const aggregates: Record<
    "STRESS" | "FATIGUE" | "CIRCADIAN" | "AUTONOMIC" | "HORMESIS" | "OVERSTRESS" | "BURNOUT" | "RECOVERY_DEBT",
    number
  > = {
    STRESS: 0,
    FATIGUE: 0,
    CIRCADIAN: 0,
    AUTONOMIC: 0,
    HORMESIS: 0,
    OVERSTRESS: 0,
    BURNOUT: 0,
    RECOVERY_DEBT: 0,
  };

  const scanLines = [...breakdown.energy, ...breakdown.focus, ...breakdown.risk];
  for (const line of scanLines) {
    const category = classifyDriverCategory(line.label);
    if (!category) continue;
    aggregates[category] += Math.abs(line.value);
  }

  const ranked = Object.entries(aggregates).sort((a, b) => b[1] - a[1]);
  const primaryCategory = ranked[0]?.[0] ?? "STRESS";
  const secondaryCategory = ranked[1]?.[0] ?? null;
  const primaryDriver = driverLabel(primaryCategory);
  const secondaryDriver =
    secondaryCategory && ranked[1][1] > 0 ? driverLabel(secondaryCategory) : null;

  const risk = snapshot.systemMetrics.risk;
  const burnout = snapshot.bio.burnoutRiskIndex;
  const recoveryDebt = snapshot.bio.recoveryDebt;
  const strain = snapshot.bio.strainIndex;

  let stabilityState = "Stable";
  if (burnout >= 70) {
    stabilityState = "Burnout risk";
  } else if (risk >= 70 || strain >= 75) {
    stabilityState = "High strain";
  } else if (risk >= 55 || recoveryDebt >= 60 || strain >= 60 || burnout >= 60) {
    stabilityState = "Imbalanced";
  } else if (risk >= 40 || recoveryDebt >= 45 || strain >= 45 || burnout >= 45) {
    stabilityState = "Sensitive";
  }

  let trajectory = "Stable";
  if (trends.lifeScoreTrend > 3) {
    trajectory = "Improving";
  } else if (trends.lifeScoreTrend < -3) {
    trajectory = "Degrading";
  } else if (trends.burnoutTrend <= -5) {
    trajectory = "Improving";
  } else if (trends.burnoutTrend >= 5) {
    trajectory = "Degrading";
  }

  return {
    primaryDriver,
    secondaryDriver,
    stabilityState,
    trajectory,
    explanation: buildExplanation(primaryDriver, stabilityState, trajectory),
  };
}

function resolveSystemMetrics(params: {
  checkin: {
    stressLevel?: number | null;
    notes?: string | null;
  };
  bio: {
    energyReserve: number;
    cognitiveFatigue: number;
    strainIndex: number;
    overloadLevel: number;
    recoveryDebt: number;
    adaptiveCapacity: number;
    sleepBuffer: number;
    circadianAlignment: number;
    sleepRegularity: number;
    stressLoad: number;
    trainingBuffer: number;
    homeostasisBias: number;
    cognitiveSaturation: number;
    sympatheticDrive: number;
    parasympatheticDrive: number;
    autonomicBalance: number;
    hormeticSignal: number;
    overstressSignal: number;
    burnoutRiskIndex: number;
    resilienceIndex: number;
  };
  adaptive: {
    riskOffset: number;
    recoveryOffset: number;
  };
}): SystemMetrics {
  const { checkin, bio, adaptive } = params;
  const metrics = parseCheckinMetrics(checkin.notes ?? null);
  const stressN = clamp(((checkin.stressLevel ?? 5) - 1) / 9, 0, 1);

  const deepWork = clamp((metrics.deepWorkMin ?? 0) / 180, 0, 1);
  const learning = clamp((metrics.learningMin ?? 0) / 90, 0, 1);
  const workout = clamp(metrics.workout ?? 0, 0, 1);
  const load = clamp(0.6 * deepWork + 0.4 * learning + 0.6 * workout, 0, 1);

  const sleep = clamp((metrics.sleepHours ?? 0) / 8, 0, 1);
  const sleepQuality = clamp((metrics.sleepQuality ?? 0) / 5, 0, 1);
  const recovery = clamp((sleep + sleepQuality + (1 - stressN)) / 3, 0, 1);

  const reserve = clamp(bio.energyReserve / 100, 0, 1);
  const fatigue = clamp(bio.cognitiveFatigue / 100, 0, 1);
  const strain = clamp(bio.strainIndex / 100, 0, 1);
  const recoverySurplus = clamp(recovery - load, -1, 1);

  const pressure =
    0.35 * (1 - reserve) +
    0.3 * fatigue +
    0.25 * strain +
    0.2 * stressN -
    0.25 * Math.max(0, recoverySurplus);

  let risk = sigmoid((pressure - 0.35) * 6) * 100;
  if (bio.overloadLevel === 1) risk += 10;
  if (bio.overloadLevel === 2) risk += 20;
  const sleepBufferSpent = Math.min(clamp(bio.sleepBuffer, 0, 100), 35);
  risk -= sleepBufferSpent * 0.15;
  risk += Math.max(0, (50 - bio.circadianAlignment) * 0.3);
  risk += bio.stressLoad * 0.1;
  risk += Math.max(0, (bio.sympatheticDrive - 60) * 0.25);
  risk -= Math.max(0, (bio.parasympatheticDrive - 60) * 0.2);
  risk += bio.overstressSignal * 0.1;
  risk -= bio.hormeticSignal * 0.06;
  if (bio.resilienceIndex >= 70) risk -= 8;
  risk = clamp(risk, 0, 100);
  const effectiveRisk = clamp(risk + adaptive.riskOffset, 0, 100);
  const effectiveRecovery = clamp(toPercent(recovery) + adaptive.recoveryOffset, 0, 100);

  return {
    load: toPercent(load),
    recovery: Math.round(effectiveRecovery * 10) / 10,
    risk: Math.round(effectiveRisk * 10) / 10,
  };
}

function buildDiagnosis(params: {
  bio: {
    energyReserve: number;
    cognitiveFatigue: number;
    strainIndex: number;
    overloadLevel: number;
    recoveryDebt: number;
    adaptiveCapacity: number;
    sleepBuffer: number;
    circadianAlignment: number;
    sleepRegularity: number;
    stressLoad: number;
    trainingBuffer: number;
    homeostasisBias: number;
    cognitiveSaturation: number;
    sympatheticDrive: number;
    parasympatheticDrive: number;
    autonomicBalance: number;
    hormeticSignal: number;
    overstressSignal: number;
    burnoutRiskIndex: number;
    resilienceIndex: number;
  };
  prevBio: {
    energyReserve: number;
    strainIndex: number;
    circadianAlignment: number;
    sleepRegularity: number;
  } | null;
  prevPrevBio: {
    energyReserve: number;
    strainIndex: number;
    circadianAlignment: number;
    sleepRegularity: number;
  } | null;
  systemMetrics: SystemMetrics;
  stressLevel: number;
  focusDelta: number;
  sleepBufferSpent: number;
  trainingBufferSpent: number;
  lifeScoreTrend: number;
}): DiagnosisPayload {
  const {
    bio,
    prevBio,
    prevPrevBio,
    systemMetrics,
    stressLevel,
    focusDelta,
    sleepBufferSpent,
    trainingBufferSpent,
    lifeScoreTrend,
  } = params;

  const strainUpTwoDays =
    prevBio !== null &&
    prevPrevBio !== null &&
    bio.strainIndex > prevBio.strainIndex &&
    prevBio.strainIndex > prevPrevBio.strainIndex;

  const isOverload = bio.overloadLevel === 2;
  const isStrainAccumulating = bio.strainIndex >= 60 || strainUpTwoDays;
  const isFatigueDominant = bio.cognitiveFatigue >= 65;
  const isRecoveryDebt = bio.recoveryDebt >= 60;
  const isAdaptiveShrink = bio.adaptiveCapacity <= 40;
  const isCircadianDrift = bio.sleepRegularity < 45 || bio.circadianAlignment < 45;
  const isStressResidue = bio.stressLoad >= 55;
  const isTrainingAdaptation = trainingBufferSpent >= 10;
  const isSaturation = bio.cognitiveSaturation >= 65;
  const isHomeostaticImbalance = bio.homeostasisBias >= 60;
  const isNegativeMomentum = lifeScoreTrend < -3;
  const isSympatheticDominance = bio.sympatheticDrive >= 70 && bio.autonomicBalance < 45;
  const isParasympatheticRecovery = bio.parasympatheticDrive >= 70 && bio.autonomicBalance > 55;
  const isHormeticAdaptation = bio.hormeticSignal >= 55 && bio.overstressSignal < 40;
  const isOverstress = bio.overstressSignal >= 55;
  const isBurnoutSpiral = bio.burnoutRiskIndex >= 70;
  const isResilienceHigh = bio.resilienceIndex >= 75 && bio.burnoutRiskIndex < 40;
  const isLowReserve = bio.energyReserve <= 35;
  const isStressInterference = stressLevel >= 8 && focusDelta < 0;
  const hasStabilizationWindow = systemMetrics.recovery >= systemMetrics.load + 10;

  let primary: DiagnosisFlag = "STABLE";
  if (isOverload) {
    primary = "OVERLOAD";
  } else if (isBurnoutSpiral) {
    primary = "BURNOUT_SPIRAL";
  } else if (isResilienceHigh) {
    primary = "RESILIENCE_HIGH";
  } else if (isRecoveryDebt) {
    primary = "RECOVERY_DEBT";
  } else if (isStrainAccumulating) {
    primary = "STRAIN_ACCUMULATING";
  } else if (isFatigueDominant) {
    primary = "FATIGUE_DOMINANT";
  } else if (isAdaptiveShrink) {
    primary = "ADAPTIVE_SHRINK";
  } else if (isCircadianDrift) {
    primary = "CIRCADIAN_DRIFT";
  } else if (isStressResidue) {
    primary = "STRESS_RESIDUE";
  } else if (isHomeostaticImbalance) {
    primary = "HOMEOSTATIC_IMBALANCE";
  } else if (isSaturation) {
    primary = "SATURATION";
  } else if (isNegativeMomentum) {
    primary = "NEGATIVE_MOMENTUM";
  } else if (isSympatheticDominance) {
    primary = "SYMPATHETIC_DOMINANCE";
  } else if (isParasympatheticRecovery) {
    primary = "PARASYMPATHETIC_RECOVERY";
  } else if (isOverstress) {
    primary = "OVERSTRESS";
  } else if (isHormeticAdaptation) {
    primary = "HORMETIC_ADAPTATION";
  } else if (isLowReserve) {
    primary = "LOW_RESERVE";
  } else if (isStressInterference) {
    primary = "STRESS_INTERFERENCE";
  }

  const forceSpecific = primary === "STABLE" && (systemMetrics.risk >= 45 || focusDelta <= -5 || bio.strainIndex >= 50);
  if (forceSpecific) {
    if (bio.strainIndex >= 50 || systemMetrics.load > systemMetrics.recovery + 5) {
      primary = "STRAIN_ACCUMULATING";
    } else if (bio.recoveryDebt >= 55) {
      primary = "RECOVERY_DEBT";
    } else if (bio.cognitiveFatigue >= 60 || focusDelta <= -5) {
      primary = "FATIGUE_DOMINANT";
    } else if (bio.adaptiveCapacity <= 45) {
      primary = "ADAPTIVE_SHRINK";
    } else if (bio.sleepRegularity < 45 || bio.circadianAlignment < 45) {
      primary = "CIRCADIAN_DRIFT";
    } else if (bio.stressLoad >= 55) {
      primary = "STRESS_RESIDUE";
    } else if (bio.homeostasisBias >= 60) {
      primary = "HOMEOSTATIC_IMBALANCE";
    } else if (bio.cognitiveSaturation >= 65) {
      primary = "SATURATION";
    } else if (lifeScoreTrend < -3) {
      primary = "NEGATIVE_MOMENTUM";
    } else if (bio.sympatheticDrive >= 70 && bio.autonomicBalance < 45) {
      primary = "SYMPATHETIC_DOMINANCE";
    } else if (bio.parasympatheticDrive >= 70 && bio.autonomicBalance > 55) {
      primary = "PARASYMPATHETIC_RECOVERY";
    } else if (bio.burnoutRiskIndex >= 70) {
      primary = "BURNOUT_SPIRAL";
    } else if (bio.resilienceIndex >= 75 && bio.burnoutRiskIndex < 40) {
      primary = "RESILIENCE_HIGH";
    } else if (bio.overstressSignal >= 55) {
      primary = "OVERSTRESS";
    } else if (bio.hormeticSignal >= 55 && bio.overstressSignal < 40) {
      primary = "HORMETIC_ADAPTATION";
    } else if (bio.energyReserve <= 40) {
      primary = "LOW_RESERVE";
    } else if (stressLevel >= 7 && focusDelta < 0) {
      primary = "STRESS_INTERFERENCE";
    } else {
      primary = systemMetrics.recovery < systemMetrics.load ? "STRAIN_ACCUMULATING" : "FATIGUE_DOMINANT";
    }
  }

  const allFlags: DiagnosisFlag[] = [
    primary,
    ...(isOverload ? (["OVERLOAD"] as const) : []),
    ...(isRecoveryDebt ? (["RECOVERY_DEBT"] as const) : []),
    ...(isStrainAccumulating ? (["STRAIN_ACCUMULATING"] as const) : []),
    ...(isFatigueDominant ? (["FATIGUE_DOMINANT"] as const) : []),
    ...(isAdaptiveShrink ? (["ADAPTIVE_SHRINK"] as const) : []),
    ...(isCircadianDrift ? (["CIRCADIAN_DRIFT"] as const) : []),
    ...(isStressResidue ? (["STRESS_RESIDUE"] as const) : []),
    ...(isTrainingAdaptation ? (["TRAINING_ADAPTATION"] as const) : []),
    ...(isSaturation ? (["SATURATION"] as const) : []),
    ...(isHomeostaticImbalance ? (["HOMEOSTATIC_IMBALANCE"] as const) : []),
    ...(isNegativeMomentum ? (["NEGATIVE_MOMENTUM"] as const) : []),
    ...(isSympatheticDominance ? (["SYMPATHETIC_DOMINANCE"] as const) : []),
    ...(isParasympatheticRecovery ? (["PARASYMPATHETIC_RECOVERY"] as const) : []),
    ...(isHormeticAdaptation ? (["HORMETIC_ADAPTATION"] as const) : []),
    ...(isOverstress ? (["OVERSTRESS"] as const) : []),
    ...(isBurnoutSpiral ? (["BURNOUT_SPIRAL"] as const) : []),
    ...(isResilienceHigh ? (["RESILIENCE_HIGH"] as const) : []),
    ...(isLowReserve ? (["LOW_RESERVE"] as const) : []),
    ...(isStressInterference ? (["STRESS_INTERFERENCE"] as const) : []),
    ...(hasStabilizationWindow ? (["STABILIZATION_WINDOW"] as const) : []),
  ];
  const flags = Array.from(new Set(allFlags));

  let title = "Bio System Stable";
  let summary = "Core bio signals are stable. Maintain the current load and recovery rhythm.";

  switch (primary) {
    case "OVERLOAD":
      title = "Critical Overload";
      summary = "Neurophysiological strain is in the critical zone. Reduce workload pressure within the next 24 hours.";
      break;
    case "STRAIN_ACCUMULATING":
      title = "Strain Accumulating";
      summary = "Recovery is insufficient for workload. Reduce cognitive load and increase restoration blocks.";
      break;
    case "RECOVERY_DEBT":
      title = "Recovery Debt Rising";
      summary = "Recovery debt is now suppressing restoration efficiency. Prioritize sleep depth and lighter workload cycles.";
      break;
    case "FATIGUE_DOMINANT":
      title = "Fatigue Dominant";
      summary = "Cognitive fatigue is suppressing focus. Protect sleep quality and trim low-value switching.";
      break;
    case "ADAPTIVE_SHRINK":
      title = "Adaptive Capacity Low";
      summary = "Adaptive capacity is shrinking, reducing training response. Hold intensity steady while restoring baseline.";
      break;
    case "LOW_RESERVE":
      title = "Low Bio Reserve";
      summary = "Energy reserve is compressed. Keep execution narrow until reserve recovers.";
      break;
    case "CIRCADIAN_DRIFT":
      title = "Circadian Drift";
      summary = "Rhythm regularity and alignment are drifting. Stabilize sleep timing and reduce late stress load.";
      break;
    case "STRESS_RESIDUE":
      title = "Stress Residue";
      summary = "Residual stress load is carrying over and suppressing recovery quality. Protect sleep and reduce pressure loops.";
      break;
    case "HOMEOSTATIC_IMBALANCE":
      title = "Homeostatic Imbalance";
      summary = "Load and recovery imbalance is building persistent physiological drag. Re-balance output and restoration.";
      break;
    case "SATURATION":
      title = "Cognitive Saturation";
      summary = "Cognitive bandwidth is saturated from recent deep-work density. Reduce cognitive intensity and reset focus windows.";
      break;
    case "NEGATIVE_MOMENTUM":
      title = "Negative Momentum";
      summary = "Recent life score trend is deteriorating. Reduce volatility and protect recovery continuity.";
      break;
    case "SYMPATHETIC_DOMINANCE":
      title = "Sympathetic Dominance";
      summary = "High sympathetic drive is sustaining alertness at a recovery cost. Reduce pressure to restore autonomic balance.";
      break;
    case "PARASYMPATHETIC_RECOVERY":
      title = "Parasympathetic Recovery";
      summary = "Parasympathetic recovery tone is strong. This is a restoration window to consolidate baseline capacity.";
      break;
    case "BURNOUT_SPIRAL":
      title = "Burnout Spiral";
      summary = "Burnout pressure is dominant and recovery efficiency is compromised. Reduce pressure and protect restoration immediately.";
      break;
    case "RESILIENCE_HIGH":
      title = "Resilience High";
      summary = "Resilience buffer is high and burnout pressure is low. Maintain rhythm and consolidate adaptation.";
      break;
    case "HORMETIC_ADAPTATION":
      title = "Hormetic Adaptation";
      summary = "Challenge load is in an adaptive zone. Preserve recovery quality to consolidate gains.";
      break;
    case "OVERSTRESS":
      title = "Overstress Signal";
      summary = "Overstress signal is elevated and adaptation efficiency is dropping. Reduce intensity and widen recovery.";
      break;
    case "STRESS_INTERFERENCE":
      title = "Stress Interference";
      summary = "High stress is disrupting focus stability. Use shorter cycles and reduce context transitions.";
      break;
    case "STABLE":
      if (hasStabilizationWindow) {
        title = "Stabilization Window";
        summary = "Recovery exceeds load and bio signals are stable. Preserve this rhythm while strain remains controlled.";
      }
      break;
  }

  const recoveryVsLoad = systemMetrics.recovery - systemMetrics.load;
  const recoveryVsLoadLabel = `${recoveryVsLoad >= 0 ? "+" : ""}${recoveryVsLoad.toFixed(1)}%`;

  return {
    title,
    summary,
    bullets: [
      { label: "Reserve", value: `${bio.energyReserve.toFixed(0)} / 100` },
      { label: "Fatigue", value: `${bio.cognitiveFatigue.toFixed(0)} / 100` },
      { label: "Strain", value: `${bio.strainIndex.toFixed(0)} / 100` },
      { label: "Recovery vs Load", value: recoveryVsLoadLabel },
      { label: "Overload level", value: String(bio.overloadLevel) },
      { label: "Stress load", value: `${bio.stressLoad.toFixed(0)} / 100` },
      { label: "Autonomic balance", value: `${bio.autonomicBalance.toFixed(0)} / 100` },
      { label: "Sympathetic", value: `${bio.sympatheticDrive.toFixed(0)} / 100` },
      { label: "Parasympathetic", value: `${bio.parasympatheticDrive.toFixed(0)} / 100` },
      { label: "Hormetic signal", value: `${bio.hormeticSignal.toFixed(0)} / 100` },
      { label: "Overstress signal", value: `${bio.overstressSignal.toFixed(0)} / 100` },
      { label: "Burnout risk", value: `${bio.burnoutRiskIndex.toFixed(0)} / 100` },
      { label: "Resilience", value: `${bio.resilienceIndex.toFixed(0)} / 100` },
      { label: "Homeostasis bias", value: `${bio.homeostasisBias.toFixed(0)} / 100` },
      { label: "Cognitive saturation", value: `${bio.cognitiveSaturation.toFixed(0)} / 100` },
      ...(sleepBufferSpent > 0 ? [{ label: "Sleep buffer spent", value: `${sleepBufferSpent.toFixed(1)} pts` }] : []),
      ...(trainingBufferSpent > 0
        ? [{ label: "Training adaptation spent", value: `${trainingBufferSpent.toFixed(1)} pts` }]
        : []),
    ],
    flags,
  };
}

function buildBreakdown(params: {
  bio: {
    energyReserve: number;
    cognitiveFatigue: number;
    strainIndex: number;
    overloadLevel: number;
    recoveryDebt: number;
    adaptiveCapacity: number;
    sleepBuffer: number;
    circadianAlignment: number;
    sleepRegularity: number;
    stressLoad: number;
    trainingBuffer: number;
    homeostasisBias: number;
    cognitiveSaturation: number;
    sympatheticDrive: number;
    parasympatheticDrive: number;
    autonomicBalance: number;
    hormeticSignal: number;
    overstressSignal: number;
    burnoutRiskIndex: number;
    resilienceIndex: number;
  };
  snapshot: {
    energy: number;
    focus: number;
    discipline: number;
  };
  normalized: NormalizedInputs;
  config: {
    reserveSleepGain: number;
    reserveWorkCost: number;
    reserveStressCost: number;
    fatigueSleepRecovery: number;
    focusFromEnergy: number;
    focusFromFatigue: number;
    focusFromStress: number;
    adaptGain: number;
    burnoutPenalty: number;
    optLoadMin: number;
    optLoadMax: number;
    bufferSpendMax: number;
    reserveFromBuffer: number;
    fatigueFromBuffer: number;
    trainingSpendMax: number;
    trainingReserveBonus: number;
    trainingDisciplineBonus: number;
    workoutSameDayCostReserve: number;
    workoutSameDayCostFatigue: number;
    stressCarry: number;
    stressGain: number;
    stressRecovery: number;
  };
  systemMetrics: SystemMetrics;
  lifeScoreTrend: number;
}): BreakdownPayload {
  const { bio, normalized, config, snapshot, systemMetrics, lifeScoreTrend } = params;
  const load01 = clamp(systemMetrics.load / 100, 0, 1);

  const reserveGain = config.reserveSleepGain * normalized.S * 100;
  const regularityScale = bio.sleepRegularity < 35 ? 0.75 : bio.sleepRegularity < 50 ? 0.85 : 1;
  const reserveGainScaled = reserveGain * regularityScale;
  const reserveRegularityPenalty = reserveGain - reserveGainScaled;
  const sleepRecoveryMultFromStress = clamp(1 - (bio.stressLoad / 100) * 0.18, 0.75, 1);
  const sleepRecoveryMultAutonomic = clamp(
    1 + (bio.parasympatheticDrive - 50) / 200 - (bio.sympatheticDrive - 50) / 250,
    0.75,
    1.25
  );
  const sleepRecoveryMult = clamp(sleepRecoveryMultFromStress * sleepRecoveryMultAutonomic, 0.75, 1.25);
  const fatigueMult = clamp(
    1 + (bio.sympatheticDrive - 50) / 200 - (bio.parasympatheticDrive - 50) / 250,
    0.8,
    1.3
  );
  const reserveGainEffective = reserveGainScaled * sleepRecoveryMult;
  const residualStressEnergy = reserveGainEffective - reserveGainScaled;
  const autonomicEnergyEffect = reserveGainScaled * (sleepRecoveryMultAutonomic - 1);
  const adaptiveScale = clamp(bio.adaptiveCapacity / 100, 0, 1);
  const debtRecoveryScale = bio.recoveryDebt > 60 ? 0.75 : 1;
  const baseFatigueRecovery = config.fatigueSleepRecovery * normalized.S * 100;
  const fatigueRecoveryScaled = baseFatigueRecovery * regularityScale;
  const fatigueRegularityPenalty = baseFatigueRecovery - fatigueRecoveryScaled;
  const fatigueRecoveryStressScaled = fatigueRecoveryScaled * sleepRecoveryMult;
  const fatigueRecovery = fatigueRecoveryStressScaled * adaptiveScale * debtRecoveryScale;
  const sleepBufferSpent = Math.min(clamp(bio.sleepBuffer, 0, 100), config.bufferSpendMax);
  const reserveBonus = sleepBufferSpent * config.reserveFromBuffer;
  const fatigueBonus = sleepBufferSpent * config.fatigueFromBuffer;
  const trainingBufferSpent = Math.min(clamp(bio.trainingBuffer, 0, 100), config.trainingSpendMax);
  const trainingReserveBonus = trainingBufferSpent * config.trainingReserveBonus;
  const trainingDisciplineBonus = trainingBufferSpent * config.trainingDisciplineBonus;
  const workoutReserveCost = normalized.W * config.workoutSameDayCostReserve;
  const workoutFatigueCost = normalized.W * config.workoutSameDayCostFatigue;
  const reserveWorkLoss = config.reserveWorkCost * normalized.DW * 100;
  const reserveStressLoss = config.reserveStressCost * (1 - normalized.T) * 100;

  const debtEnergyCapPenalty = bio.recoveryDebt > 70 ? 10 : 0;
  const energyCap = clamp((bio.overloadLevel === 2 ? 75 : bio.overloadLevel === 1 ? 90 : 100) - debtEnergyCapPenalty, 0, 100);
  const capPenalty = snapshot.energy >= energyCap ? Math.max(0, 100 - energyCap) : 0;

  const energy: BreakdownLine[] = [
    {
      label: "Sleep recovery",
      value: reserveGainEffective * 0.9 + fatigueRecovery * 0.1,
      tone: "positive",
    },
    {
      label: "Deep work cost",
      value: -reserveWorkLoss,
      tone: "negative",
    },
    {
      label: "Stress drain",
      value: -reserveStressLoss,
      tone: "negative",
    },
    {
      label: "Delayed sleep recovery",
      value: reserveBonus,
      tone: reserveBonus > 0 ? "positive" : "neutral",
    },
    {
      label: "Autonomic balance effect",
      value: autonomicEnergyEffect,
      tone: autonomicEnergyEffect > 0 ? "positive" : autonomicEnergyEffect < 0 ? "negative" : "neutral",
    },
    {
      label: "Residual stress load",
      value: residualStressEnergy,
      tone: residualStressEnergy < 0 ? "negative" : "neutral",
    },
    {
      label: "Training adaptation (delayed)",
      value: trainingReserveBonus,
      tone: trainingReserveBonus > 0 ? "positive" : "neutral",
    },
    {
      label: "Workout cost",
      value: -workoutReserveCost,
      tone: workoutReserveCost > 0 ? "negative" : "neutral",
    },
    {
      label: "Sleep regularity penalty",
      value: -reserveRegularityPenalty,
      tone: reserveRegularityPenalty > 0 ? "negative" : "neutral",
    },
    {
      label: "Burnout spiral pressure",
      value: bio.burnoutRiskIndex >= 65 ? -8 : 0,
      tone: bio.burnoutRiskIndex >= 65 ? "negative" : "neutral",
    },
    {
      label: "Resilience buffer effect",
      value: bio.resilienceIndex >= 70 ? 2 : 0,
      tone: bio.resilienceIndex >= 70 ? "positive" : "neutral",
    },
  ];
  if (capPenalty > 0) {
    energy.push({
      label: "Overload cap",
      value: -capPenalty,
      tone: "negative",
    });
  }

  const focus: BreakdownLine[] = [
    {
      label: "Energy availability",
      value: config.focusFromEnergy * (snapshot.energy - 50),
      tone: "positive",
    },
    {
      label: "Cognitive fatigue",
      value: -config.focusFromFatigue * (bio.cognitiveFatigue - 30),
      tone: "negative",
    },
    {
      label: "Stress interference",
      value: -config.focusFromStress * ((1 - normalized.T) * 50),
      tone: "negative",
    },
    {
      label: "Recovery debt impact",
      value: -bio.recoveryDebt * 0.15,
      tone: "negative",
    },
    {
      label: "Residual stress load",
      value: -bio.stressLoad * 0.12,
      tone: "negative",
    },
    {
      label: "Cognitive saturation effect",
      value: bio.cognitiveSaturation > 60 ? -(bio.cognitiveSaturation - 60) * 0.4 : 0,
      tone: bio.cognitiveSaturation > 60 ? "negative" : "neutral",
    },
    {
      label: "Circadian alignment effect",
      value: bio.circadianAlignment < 50 ? -(50 - bio.circadianAlignment) * 0.25 : 0,
      tone: bio.circadianAlignment < 50 ? "negative" : "neutral",
    },
    {
      label: "Autonomic balance effect",
      value: bio.sympatheticDrive > 70 && bio.cognitiveFatigue < 60 ? (bio.sympatheticDrive - 70) * 0.15 : 0,
      tone:
        bio.sympatheticDrive > 70 && bio.cognitiveFatigue < 60
          ? "positive"
          : bio.autonomicBalance < 45
            ? "negative"
            : "neutral",
    },
    {
      label: "Burnout spiral pressure",
      value: bio.burnoutRiskIndex >= 65 ? -(bio.burnoutRiskIndex - 65) * 0.25 : 0,
      tone: bio.burnoutRiskIndex >= 65 ? "negative" : "neutral",
    },
    {
      label: "Resilience buffer effect",
      value: bio.resilienceIndex >= 70 ? 1.5 : 0,
      tone: bio.resilienceIndex >= 70 ? "positive" : "neutral",
    },
  ];

  const fatigue: BreakdownLine[] = [
    {
      label: "Sleep recovery",
      value: -fatigueRecovery,
      tone: "positive",
    },
    {
      label: "Workload fatigue",
      value: config.focusFromFatigue * (bio.cognitiveFatigue - 30),
      tone: "negative",
    },
    {
      label: "Delayed sleep recovery",
      value: -fatigueBonus,
      tone: fatigueBonus > 0 ? "positive" : "neutral",
    },
    {
      label: "Residual stress load",
      value: bio.stressLoad * 0.1,
      tone: bio.stressLoad > 0 ? "negative" : "neutral",
    },
    {
      label: "Autonomic balance effect",
      value: Math.max(0, fatigueMult - 1) * 8 - Math.max(0, 1 - fatigueMult) * 8,
      tone: fatigueMult > 1 ? "negative" : fatigueMult < 1 ? "positive" : "neutral",
    },
    {
      label: "Cognitive saturation effect",
      value: Math.max(0, bio.cognitiveSaturation - 60) * 0.2,
      tone: bio.cognitiveSaturation > 60 ? "negative" : "neutral",
    },
    {
      label: "Workout cost",
      value: workoutFatigueCost,
      tone: workoutFatigueCost > 0 ? "negative" : "neutral",
    },
    {
      label: "Sleep regularity penalty",
      value: fatigueRegularityPenalty,
      tone: fatigueRegularityPenalty > 0 ? "negative" : "neutral",
    },
    {
      label: "Burnout spiral pressure",
      value: bio.burnoutRiskIndex >= 65 ? (bio.burnoutRiskIndex - 65) * 0.3 : 0,
      tone: bio.burnoutRiskIndex >= 65 ? "negative" : "neutral",
    },
    {
      label: "Resilience buffer effect",
      value: bio.resilienceIndex >= 70 ? -2 : 0,
      tone: bio.resilienceIndex >= 70 ? "positive" : "neutral",
    },
  ];

  const strainReduction = sleepBufferSpent * 0.2;
  const strain: BreakdownLine[] = [
    {
      label: "Sleep stabilization effect",
      value: -strainReduction,
      tone: strainReduction > 0 ? "positive" : "neutral",
    },
  ];

  const inOptimalWindow = load01 >= config.optLoadMin && load01 <= config.optLoadMax;
  const disciplineGain = inOptimalWindow && bio.overloadLevel === 0 ? config.adaptGain * load01 * 100 * adaptiveScale : 0;
  const disciplinePenalty = bio.overloadLevel >= 1 ? config.burnoutPenalty * bio.strainIndex : 0;
  const hormeticAdaptationValue = bio.hormeticSignal * 0.05;
  const overstressPenaltyValue = bio.overstressSignal * 0.06;
  const discipline: BreakdownLine[] = [];

  if (disciplineGain > 0) {
    discipline.push({
      label: "Adaptive gain",
      value: disciplineGain,
      tone: "positive",
    });
  }

  if (disciplinePenalty > 0) {
    discipline.push({
      label: "Strain penalty",
      value: -disciplinePenalty,
      tone: "negative",
    });
  }

  const adaptiveModulationValue =
    inOptimalWindow && bio.overloadLevel === 0 ? config.adaptGain * load01 * 100 * (adaptiveScale - 1) : 0;
  if (trainingDisciplineBonus > 0) {
    discipline.push({
      label: "Training adaptation (delayed)",
      value: trainingDisciplineBonus,
      tone: "positive",
    });
  }
  discipline.push({
    label: "Homeostatic imbalance penalty",
    value: bio.homeostasisBias > 60 ? -bio.homeostasisBias * 0.05 : 0,
    tone: bio.homeostasisBias > 60 ? "negative" : "neutral",
  });
  discipline.push({
    label: "Adaptive capacity modulation",
    value: adaptiveModulationValue,
    tone: adaptiveModulationValue === 0 ? "neutral" : "negative",
  });
  discipline.push({
    label: "Hormetic adaptation",
    value: hormeticAdaptationValue,
    tone: hormeticAdaptationValue > 0 ? "positive" : "neutral",
  });
  discipline.push({
    label: "Overstress penalty",
    value: -overstressPenaltyValue,
    tone: overstressPenaltyValue > 0 ? "negative" : "neutral",
  });

  if (discipline.length === 0) {
    discipline.push({
      label: "Adaptive gain",
      value: 0,
      tone: "neutral",
    });
  }

  const riskStabilization = sleepBufferSpent * 0.15;
  const circadianRiskAddon = Math.max(0, (50 - bio.circadianAlignment) * 0.3);
  const stressRiskAddon = bio.stressLoad * 0.1;
  const hormeticRiskEffect = -bio.hormeticSignal * 0.06;
  const overstressRiskEffect = bio.overstressSignal * 0.1;
  const burnoutRiskPressure = bio.burnoutRiskIndex >= 65 ? (bio.burnoutRiskIndex - 65) * 0.12 : 0;
  const resilienceRiskBuffer = bio.resilienceIndex >= 70 ? -8 : 0;
  const risk: BreakdownLine[] = [
    {
      label: "Sleep stabilization effect",
      value: -riskStabilization,
      tone: riskStabilization > 0 ? "positive" : "neutral",
    },
    {
      label: "Circadian alignment effect",
      value: circadianRiskAddon,
      tone: circadianRiskAddon > 0 ? "negative" : "neutral",
    },
    {
      label: "Residual stress load",
      value: stressRiskAddon,
      tone: stressRiskAddon > 0 ? "negative" : "neutral",
    },
    {
      label: "Autonomic balance effect",
      value:
        Math.max(0, (bio.sympatheticDrive - 60) * 0.25) -
        Math.max(0, (bio.parasympatheticDrive - 60) * 0.2),
      tone: bio.autonomicBalance < 45 ? "negative" : bio.autonomicBalance > 55 ? "positive" : "neutral",
    },
    {
      label: "Hormetic adaptation",
      value: hormeticRiskEffect,
      tone: hormeticRiskEffect < 0 ? "positive" : "neutral",
    },
    {
      label: "Overstress penalty",
      value: overstressRiskEffect,
      tone: overstressRiskEffect > 0 ? "negative" : "neutral",
    },
    {
      label: "Burnout spiral pressure",
      value: burnoutRiskPressure,
      tone: burnoutRiskPressure > 0 ? "negative" : "neutral",
    },
    {
      label: "Resilience buffer effect",
      value: resilienceRiskBuffer,
      tone: resilienceRiskBuffer < 0 ? "positive" : "neutral",
    },
    {
      label: "Performance momentum effect",
      value: lifeScoreTrend > 3 ? -5 : lifeScoreTrend < -3 ? 6 : 0,
      tone: lifeScoreTrend > 3 ? "positive" : lifeScoreTrend < -3 ? "negative" : "neutral",
    },
  ];

  return { energy, focus, discipline, fatigue, strain, risk };
}

async function bootstrapDemoDayIfNeeded(userId: string, date: Date): Promise<boolean> {
  void userId;
  void date;
  // Live demo is strict read-only: no auto-creation for missing dates.
  return false;
}

function resolveStatus(
  raw: SystemStatus,
  lifeScore: number,
  series7d: Array<{
    lifeScore: number;
    stats: { discipline: number; growth: number };
  }>
): "Stable" | "Overloaded" | "Declining" | "Growth" {
  if (raw === SystemStatus.CRITICAL) return "Overloaded";
  if (raw === SystemStatus.WARNING) return "Declining";

  if (series7d.length < 2) return "Stable";

  const current = series7d[series7d.length - 1];
  const prev = series7d[series7d.length - 2];
  const baseline = average(series7d.slice(0, -1).map((item) => item.lifeScore));
  const trend = lifeScore - baseline;

  if (trend > 1.5 && current.stats.growth > prev.stats.growth && current.stats.discipline > prev.stats.discipline) {
    return "Growth";
  }

  return "Stable";
}

export async function GET(request: Request) {
  const requestTimer = startTiming("api.control-room.GET");
  const noStoreHeaders = { "Cache-Control": "no-store" };
  try {
    const demoMode = isDemoModeRequest(request);
    const sessionTimer = startTiming("api.control-room.auth", { demoMode });
    const session = await auth();
    sessionTimer.end({ hasSession: Boolean(session?.user?.id) });
    const sessionUserId = session?.user?.id;
    if (!sessionUserId && !demoMode) {
      requestTimer.end({ status: 401 });
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });
    }
    if (demoMode) {
      const demoSeedTimer = startTiming("api.control-room.ensureLiveDemoData");
      await ensureLiveDemoData();
      demoSeedTimer.end();
    }
    const effectiveUserId = demoMode ? LIVE_DEMO_USER_ID : (sessionUserId as string);

    const { searchParams } = new URL(request.url);
    const requestedDate = searchParams.get("date") ?? undefined;
    const requestedTzOffset = searchParams.get("tzOffsetMinutes") ?? undefined;
    const payload = controlRoomQuerySchema.parse({
      userId: effectiveUserId,
      date: requestedDate,
      tzOffsetMinutes: requestedTzOffset,
    });
    const userTimer = startTiming("api.control-room.ensureUserWithPlan", { userId: effectiveUserId });
    const user = await ensureUserWithPlan(effectiveUserId, request);
    userTimer.end({ plan: user.plan });
    const isPro = hasOperator(user);
    const tzOffsetMinutes = clampTzOffsetMinutes(payload.tzOffsetMinutes);
    const date = payload.date ? toUtcDateOnly(payload.date) : toUtcDateOnly(getDayKeyAtOffset(new Date(), tzOffsetMinutes));
    const recent7DayKeys = getRecentDayKeysAtOffset({ anchor: date, days: 7, tzOffsetMinutes });
    const recent7DayDates = recent7DayKeys.map(dayKeyToUtcDate);
    const recent7DayDateSet = new Set(recent7DayKeys);

    const primaryQueryTimer = startTiming("api.control-room.primaryQueries", { userId: user.id });
    let snapshot = await prisma.statSnapshot.findUnique({
      where: { userId_date: { userId: user.id, date } },
      include: { contributions: true },
    });

    let checkin = await prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId: user.id, date } },
      select: {
        id: true,
        date: true,
        mood: true,
        stressLevel: true,
        energyLevel: true,
        bedtimeMinutes: true,
        wakeTimeMinutes: true,
        notes: true,
        configVersion: true,
      },
    });

    const todayDate = toUtcDateOnly(getDayKeyAtOffset(new Date(), tzOffsetMinutes));
    const todayCheckin = await prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId: user.id, date: todayDate } },
      select: { id: true },
    });

    let bioState = await prisma.bioStateSnapshot.findUnique({
      where: { userId_date: { userId: user.id, date } },
      select: {
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
    primaryQueryTimer.end({
      hasSnapshot: Boolean(snapshot),
      hasCheckin: Boolean(checkin),
      hasBioState: Boolean(bioState),
      hasTodayCheckin: Boolean(todayCheckin?.id),
    });

    if (!snapshot) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[control-room] snapshot missing date=${formatDateOnly(date)}; dailyCheckInFound=${Boolean(checkin)}`
        );
      }

      if (!checkin) {
        const bootstrapped = await bootstrapDemoDayIfNeeded(user.id, date);
        if (bootstrapped) {
          snapshot = await prisma.statSnapshot.findUnique({
            where: { userId_date: { userId: user.id, date } },
            include: { contributions: true },
          });
          checkin = await prisma.dailyCheckIn.findUnique({
            where: { userId_date: { userId: user.id, date } },
          select: {
            id: true,
            date: true,
            mood: true,
            stressLevel: true,
            energyLevel: true,
            bedtimeMinutes: true,
            wakeTimeMinutes: true,
              notes: true,
              configVersion: true,
            },
          });
          bioState = await prisma.bioStateSnapshot.findUnique({
            where: { userId_date: { userId: user.id, date } },
            select: {
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
        }
      }

      if (!checkin && !snapshot) {
        const hasAnyCheckins =
          (await prisma.dailyCheckIn.count({
            where: { userId: user.id },
          })) > 0;
        return NextResponse.json(
          {
            ok: false,
            code: "CHECKIN_NOT_FOUND",
            message: `Daily check-in not found at date=${formatDateOnly(date)}`,
            date: formatDateOnly(date),
            hasAnyCheckins,
          },
          { status: 404, headers: noStoreHeaders }
        );
      }

      if (!snapshot && checkin) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[control-room] recalculating snapshot from dailyCheckIn id=${checkin.id} configVersion=${checkin.configVersion}`
          );
        }

        await recalculateDay(user.id, date);

        snapshot = await prisma.statSnapshot.findUnique({
          where: { userId_date: { userId: user.id, date } },
          include: { contributions: true },
        });

        bioState = await prisma.bioStateSnapshot.findUnique({
          where: { userId_date: { userId: user.id, date } },
          select: {
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

        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[control-room] recalculate completed date=${formatDateOnly(date)}; snapshotCreated=${Boolean(snapshot)}`
          );
        }

        if (!snapshot) {
          throw new ApiError(500, "Snapshot could not be created from existing daily check-in.");
        }
      }
    }

    if (!snapshot) {
      throw new ApiError(500, "Snapshot is unavailable.");
    }

    const metrics = parseCheckinMetrics(checkin?.notes ?? null);
    const normalized = normalizeInputs(checkin?.stressLevel, metrics);
    const filledFields = [
      checkin?.mood,
      checkin?.stressLevel,
      checkin?.energyLevel,
      metrics.sleepHours,
      metrics.sleepQuality,
      metrics.workout,
      metrics.deepWorkMin,
      metrics.learningMin,
      metrics.moneyDelta,
    ].filter((value) => typeof value === "number").length;

    const telemetry = {
      quality: resolveTelemetryQuality(filledFields),
      filledFields,
      totalFields: TELEMETRY_FIELD_COUNT,
      estimated: false,
    } as const;

    const resolvedBio = bioState ?? {
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

    const systemMetrics = resolveSystemMetrics({
      checkin: {
        stressLevel: checkin?.stressLevel,
        notes: checkin?.notes,
      },
      bio: resolvedBio,
      adaptive: {
        riskOffset: user.adaptiveRiskOffset ?? 0,
        recoveryOffset: user.adaptiveRecoveryOffset ?? 0,
      },
    });

    const analyticsTimer = startTiming("api.control-room.analyticsQueries", { userId: user.id });
    const previousBioRows = await prisma.bioStateSnapshot.findMany({
      where: { userId: user.id, date: { lt: date } },
      orderBy: { date: "desc" },
      take: 2,
      select: {
        energyReserve: true,
        strainIndex: true,
        circadianAlignment: true,
        sleepRegularity: true,
        burnoutRiskIndex: true,
      },
    });

    const previousStatRows = await prisma.statSnapshot.findMany({
      where: { userId: user.id, date: { lt: date } },
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

    const lifeScoreTrendRows = await prisma.statSnapshot.findMany({
      where: { userId: user.id, date: { lte: date } },
      orderBy: { date: "desc" },
      take: 6,
      select: { lifeScore: true },
    });
    const recent3 = lifeScoreTrendRows.slice(0, 3).map((row) => toNumber(row.lifeScore));
    const previous3 = lifeScoreTrendRows.slice(3, 6).map((row) => toNumber(row.lifeScore));
    const lifeScoreTrend =
      recent3.length === 3 && previous3.length === 3
        ? recent3.reduce((sum, value) => sum + value, 0) / 3 - previous3.reduce((sum, value) => sum + value, 0) / 3
        : 0;

    const checkins7dRows = await prisma.dailyCheckIn.findMany({
      where: {
        userId: user.id,
        date: { in: recent7DayDates },
      },
      select: {
        date: true,
        stressLevel: true,
        notes: true,
      },
    });
    const checkins7d = Array.from(
      new Map(
        checkins7dRows
          .filter((row) => recent7DayDateSet.has(formatDateOnly(row.date)))
          .map((row) => [formatDateOnly(row.date), row])
      ).values()
    );

    const avgInputs = (() => {
      if (checkins7d.length === 0) {
        return {
          sleepHours: 7,
          sleepQuality: 3.5,
          workout: 0 as 0 | 1,
          deepWorkMin: 60,
          learningMin: 20,
          moneyDelta: 0,
          stress: 5,
          sleepRegularity: resolvedBio.sleepRegularity,
          cognitiveSaturation: resolvedBio.cognitiveSaturation,
        };
      }

      const sum = checkins7d.reduce(
        (acc, row) => {
          const m = parseCheckinMetrics(row.notes);
          acc.sleepHours += m.sleepHours ?? 0;
          acc.sleepQuality += m.sleepQuality ?? 0;
          acc.workout += m.workout && m.workout > 0 ? 1 : 0;
          acc.deepWorkMin += m.deepWorkMin ?? 0;
          acc.learningMin += m.learningMin ?? 0;
          acc.moneyDelta += m.moneyDelta ?? 0;
          acc.stress += clamp(row.stressLevel ?? 5, 1, 10);
          return acc;
        },
        {
          sleepHours: 0,
          sleepQuality: 0,
          workout: 0,
          deepWorkMin: 0,
          learningMin: 0,
          moneyDelta: 0,
          stress: 0,
        }
      );
      const days = checkins7d.length;
      const avgDeepWork = sum.deepWorkMin / days;
      return {
        sleepHours: sum.sleepHours / days,
        sleepQuality: sum.sleepQuality / days,
        workout: (sum.workout / days >= 0.5 ? 1 : 0) as 0 | 1,
        deepWorkMin: avgDeepWork,
        learningMin: sum.learningMin / days,
        moneyDelta: sum.moneyDelta / days,
        stress: sum.stress / days,
        sleepRegularity: resolvedBio.sleepRegularity,
        cognitiveSaturation: clamp((avgDeepWork * 3 * 100) / 360, 0, 100),
      };
    })();

    const config = await prisma.weightConfig.findUnique({
      where: { configVersion: snapshot.configVersion },
      select: {
        reserveSleepGain: true,
        reserveWorkCost: true,
        reserveStressCost: true,
        fatigueSleepRecovery: true,
        focusFromEnergy: true,
        focusFromFatigue: true,
        focusFromStress: true,
        adaptGain: true,
        burnoutPenalty: true,
        optLoadMin: true,
        optLoadMax: true,
        bufferSpendMax: true,
        reserveFromBuffer: true,
        fatigueFromBuffer: true,
        trainingSpendMax: true,
        trainingReserveBonus: true,
        trainingDisciplineBonus: true,
        workoutSameDayCostReserve: true,
        workoutSameDayCostFatigue: true,
        stressCarry: true,
        stressGain: true,
        stressRecovery: true,
      },
    });

    const resolvedConfig = config ?? {
      reserveSleepGain: 0.06,
      reserveWorkCost: 0.03,
      reserveStressCost: 0.04,
      fatigueSleepRecovery: 0.045,
      focusFromEnergy: 0.11,
      focusFromFatigue: 0.09,
      focusFromStress: 0.12,
      adaptGain: 0.03,
      burnoutPenalty: 0.06,
      optLoadMin: 0.35,
      optLoadMax: 0.75,
      bufferSpendMax: 35,
      reserveFromBuffer: 0.35,
      fatigueFromBuffer: 0.45,
      trainingSpendMax: 20,
      trainingReserveBonus: 0.18,
      trainingDisciplineBonus: 0.28,
      workoutSameDayCostReserve: 8,
      workoutSameDayCostFatigue: 6,
      stressCarry: 0.75,
      stressGain: 0.9,
      stressRecovery: 0.35,
    };
    const calibrationProfile = await buildCalibrationProfile({
      userId: user.id,
      endDate: date,
      windowDays: 30,
    });
    analyticsTimer.end({
      previousBioRows: previousBioRows.length,
      previousStatRows: previousStatRows.length,
      checkins7d: checkins7d.length,
    });
    const calibration: CalibrationPayload = {
      active: calibrationProfile.calibrationActive,
      confidence: calibrationProfile.confidence,
      sensitivities: summarizeSensitivityLevels(calibrationProfile),
    };

    let projection30d: Projection30dPayload | null = null;
    if (isPro) {
      const projectionConfigRow = await prisma.weightConfig.findUnique({
        where: { configVersion: snapshot.configVersion },
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

      if (projectionConfigRow) {
        const projectionConfig = buildWeightConfig(projectionConfigRow);
        const initialBioState: PreviousBioStateInput = {
          date,
          energyReserve: resolvedBio.energyReserve,
          cognitiveFatigue: resolvedBio.cognitiveFatigue,
          strainIndex: resolvedBio.strainIndex,
          overloadLevel: clamp(resolvedBio.overloadLevel, 0, 2) as 0 | 1 | 2,
          recoveryDebt: resolvedBio.recoveryDebt,
          adaptiveCapacity: resolvedBio.adaptiveCapacity,
          sleepBuffer: resolvedBio.sleepBuffer,
          circadianAlignment: resolvedBio.circadianAlignment,
          sleepRegularity: resolvedBio.sleepRegularity,
          stressLoad: resolvedBio.stressLoad,
          trainingBuffer: resolvedBio.trainingBuffer,
          homeostasisBias: resolvedBio.homeostasisBias,
          cognitiveSaturation: resolvedBio.cognitiveSaturation,
          sympatheticDrive: resolvedBio.sympatheticDrive,
          parasympatheticDrive: resolvedBio.parasympatheticDrive,
          autonomicBalance: resolvedBio.autonomicBalance,
          hormeticSignal: resolvedBio.hormeticSignal,
          overstressSignal: resolvedBio.overstressSignal,
          burnoutRiskIndex: resolvedBio.burnoutRiskIndex,
          resilienceIndex: resolvedBio.resilienceIndex,
        };

        const prevBioStateForSim: PreviousBioStateInput | undefined = previousBioRows[0]
          ? {
              date: new Date(date.getTime() - 86400000),
              energyReserve: previousBioRows[0].energyReserve,
              cognitiveFatigue: resolvedBio.cognitiveFatigue,
              strainIndex: previousBioRows[0].strainIndex,
              overloadLevel: clamp(resolvedBio.overloadLevel, 0, 2) as 0 | 1 | 2,
              recoveryDebt: resolvedBio.recoveryDebt,
              adaptiveCapacity: resolvedBio.adaptiveCapacity,
              sleepBuffer: resolvedBio.sleepBuffer,
              circadianAlignment: previousBioRows[0].circadianAlignment,
              sleepRegularity: previousBioRows[0].sleepRegularity,
              stressLoad: resolvedBio.stressLoad,
              trainingBuffer: resolvedBio.trainingBuffer,
              homeostasisBias: resolvedBio.homeostasisBias,
              cognitiveSaturation: resolvedBio.cognitiveSaturation,
              sympatheticDrive: resolvedBio.sympatheticDrive,
              parasympatheticDrive: resolvedBio.parasympatheticDrive,
              autonomicBalance: resolvedBio.autonomicBalance,
              hormeticSignal: resolvedBio.hormeticSignal,
              overstressSignal: resolvedBio.overstressSignal,
              burnoutRiskIndex: resolvedBio.burnoutRiskIndex,
              resilienceIndex: resolvedBio.resilienceIndex,
            }
          : undefined;

        const previousSnapshotForSim: PreviousSnapshotInput | undefined = previousStatRows[0]
          ? {
              date: previousStatRows[0].date,
              lifeScore: toNumber(previousStatRows[0].lifeScore),
              stats: {
                Energy: toNumber(previousStatRows[0].health),
                Focus: toNumber(previousStatRows[0].relationships),
                Discipline: toNumber(previousStatRows[0].career),
                Finance: toNumber(previousStatRows[0].finance),
                Growth: toNumber(previousStatRows[0].personalGrowth),
              },
            }
          : undefined;

        projection30d = {
          baseline: simulateForward({
            initialSnapshot: {
              date,
              stats: {
                energy: toNumber(snapshot.health),
                focus: toNumber(snapshot.relationships),
                discipline: toNumber(snapshot.career),
                finance: toNumber(snapshot.finance),
                growth: toNumber(snapshot.personalGrowth),
              },
              lifeScore: toNumber(snapshot.lifeScore),
              bio: initialBioState,
            },
            avgInputs,
            scenarioType: "BASELINE",
            config: projectionConfig,
            previousSnapshot: previousSnapshotForSim,
            previousBioState: prevBioStateForSim,
            previousLifeScores: lifeScoreTrendRows.map((row) => toNumber(row.lifeScore)).reverse(),
            calibration: {
              calibrationActive: calibrationProfile.calibrationActive,
              confidence: calibrationProfile.confidence,
              multipliers: calibrationProfile.multipliers,
            },
          }),
          stabilization: simulateForward({
            initialSnapshot: {
              date,
              stats: {
                energy: toNumber(snapshot.health),
                focus: toNumber(snapshot.relationships),
                discipline: toNumber(snapshot.career),
                finance: toNumber(snapshot.finance),
                growth: toNumber(snapshot.personalGrowth),
              },
              lifeScore: toNumber(snapshot.lifeScore),
              bio: initialBioState,
            },
            avgInputs,
            scenarioType: "STABILIZATION",
            config: projectionConfig,
            previousSnapshot: previousSnapshotForSim,
            previousBioState: prevBioStateForSim,
            previousLifeScores: lifeScoreTrendRows.map((row) => toNumber(row.lifeScore)).reverse(),
            calibration: {
              calibrationActive: calibrationProfile.calibrationActive,
              confidence: calibrationProfile.confidence,
              multipliers: calibrationProfile.multipliers,
            },
          }),
          overload: simulateForward({
            initialSnapshot: {
              date,
              stats: {
                energy: toNumber(snapshot.health),
                focus: toNumber(snapshot.relationships),
                discipline: toNumber(snapshot.career),
                finance: toNumber(snapshot.finance),
                growth: toNumber(snapshot.personalGrowth),
              },
              lifeScore: toNumber(snapshot.lifeScore),
              bio: initialBioState,
            },
            avgInputs,
            scenarioType: "OVERLOAD",
            config: projectionConfig,
            previousSnapshot: previousSnapshotForSim,
            previousBioState: prevBioStateForSim,
            previousLifeScores: lifeScoreTrendRows.map((row) => toNumber(row.lifeScore)).reverse(),
            calibration: {
              calibrationActive: calibrationProfile.calibrationActive,
              confidence: calibrationProfile.confidence,
              multipliers: calibrationProfile.multipliers,
            },
          }),
        };
      }
    }

    const sleepBufferSpent = Math.min(clamp(resolvedBio.sleepBuffer, 0, 100), resolvedConfig.bufferSpendMax);
    const trainingBufferSpent = Math.min(clamp(resolvedBio.trainingBuffer, 0, 100), resolvedConfig.trainingSpendMax);

    const diagnosis = buildDiagnosis({
      bio: resolvedBio,
      prevBio: previousBioRows[0] ?? null,
      prevPrevBio: previousBioRows[1] ?? null,
      systemMetrics,
      stressLevel: checkin?.stressLevel ?? 5,
      focusDelta:
        toNumber(snapshot.relationships) -
        (previousStatRows[0] ? toNumber(previousStatRows[0].relationships) : toNumber(snapshot.relationships)),
      sleepBufferSpent,
      trainingBufferSpent,
      lifeScoreTrend,
    });

    const breakdown = buildBreakdown({
      bio: resolvedBio,
      snapshot: {
        energy: toNumber(snapshot.health),
        focus: toNumber(snapshot.relationships),
        discipline: toNumber(snapshot.career),
      },
      normalized,
      config: resolvedConfig,
      systemMetrics,
      lifeScoreTrend,
    });
    const burnoutTrend =
      previousBioRows[0] && typeof previousBioRows[0].burnoutRiskIndex === "number"
        ? resolvedBio.burnoutRiskIndex - previousBioRows[0].burnoutRiskIndex
        : 0;
    const executiveSummary = buildExecutiveSummary({
      snapshot: {
        systemMetrics,
        bio: {
          burnoutRiskIndex: resolvedBio.burnoutRiskIndex,
          resilienceIndex: resolvedBio.resilienceIndex,
          recoveryDebt: resolvedBio.recoveryDebt,
          strainIndex: resolvedBio.strainIndex,
        },
      },
      breakdown,
      trends: {
        lifeScoreTrend,
        burnoutTrend,
      },
    });
    const patterns = await detectPatterns({
      userId: user.id,
      endDateISO: formatDateOnly(snapshot.date),
      windowDays: 21,
    });
    const modelConfidence = await computeConfidence({
      userId: user.id,
      endDateISO: formatDateOnly(snapshot.date),
    }).catch(() => ({
      confidence: 0.5,
      components: {
        coverageScore: 0.5,
        completenessScore: 0.5,
        stabilityScore: 0.5,
        convergenceScore: 0.5,
        patternScore: 0.5,
        sensitivityScore: 0.5,
        daysWithCheckin: 0,
        meanDelta: 0,
        calibrationDrift: null,
        projectionSpread: 0,
        windowDays: 30,
      },
      notes: ["Model confidence unavailable"],
    }));
    const riskSeries14d = await extractSeries(user.id, formatDateOnly(snapshot.date), 14);
    const risk14Values = riskSeries14d
      .map((point) => point.risk)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const avgRisk14dRaw = risk14Values.length > 0 ? average(risk14Values) : systemMetrics.risk;
    const avgRisk14d = clamp(avgRisk14dRaw + (user.adaptiveRiskOffset ?? 0), 0, 100);
    const recentRiskWindow = risk14Values.slice(-7);
    const previousRiskWindow = risk14Values.slice(-14, -7);
    const riskDelta7d =
      recentRiskWindow.length > 0
        ? average(recentRiskWindow) - (previousRiskWindow.length > 0 ? average(previousRiskWindow) : recentRiskWindow[0] ?? 0)
        : 0;
    const recoveryPatternForGuardrail = deriveRecoveryPatternForGuardrail({
      lifeScoreDelta7d: lifeScoreTrend,
      riskDelta7d,
      burnoutDelta7d: burnoutTrend,
      load: systemMetrics.load,
      recovery: systemMetrics.recovery,
      sleepHours: metrics.sleepHours,
      sleepQuality: metrics.sleepQuality,
      stress: checkin?.stressLevel ?? null,
      deepWorkMin: metrics.deepWorkMin,
      workout: metrics.workout,
      circadianAlignment: resolvedBio.circadianAlignment,
    });
    const guardrail = evaluateGuardrail({
      currentRisk: systemMetrics.risk,
      avgRisk14d,
      burnout: resolvedBio.burnoutRiskIndex,
      confidence: modelConfidence.confidence,
      adaptiveRiskOffset: user.adaptiveRiskOffset ?? 0,
      recoveryDebt: resolvedBio.recoveryDebt,
      adaptiveCapacity: resolvedBio.adaptiveCapacity,
      resilience: resolvedBio.resilienceIndex,
      overloadLevel: resolvedBio.overloadLevel,
      lifeScore: toNumber(snapshot.lifeScore),
      lifeScoreDelta7d: lifeScoreTrend,
      riskDelta7d,
      burnoutDelta7d: burnoutTrend,
      load: systemMetrics.load,
      recovery: systemMetrics.recovery,
      recoveryPattern: recoveryPatternForGuardrail,
    });

    const activeProtocolCandidates = await prisma.protocolRun.findMany({
      where: {
        userId: user.id,
        appliedAt: { not: null },
      },
      orderBy: { appliedAt: "desc" },
      take: 10,
      select: {
        appliedAt: true,
        horizonHours: true,
        inputs: true,
        protocol: true,
      },
    });
    const activeProtocol = getActiveProtocol(activeProtocolCandidates);
    const protocolInputs =
      activeProtocol && activeProtocol.inputs && typeof activeProtocol.inputs === "object"
        ? (activeProtocol.inputs as Record<string, unknown>)
        : null;
    const riskAtApply =
      protocolInputs && typeof protocolInputs.risk === "number" && Number.isFinite(protocolInputs.risk)
        ? protocolInputs.risk
        : null;
    const requiredMinRecovery =
      protocolInputs && typeof protocolInputs.recovery === "number" && Number.isFinite(protocolInputs.recovery)
        ? protocolInputs.recovery
        : null;
    const integrityComputed = computeIntegrity({
      activeProtocol: activeProtocol
        ? {
            constraints: parseProtocolConstraints(activeProtocol.protocol),
            riskAtApply,
            requiredMinRecovery,
          }
        : null,
      currentInputs: {
        deepWorkMinutes: metrics.deepWorkMin ?? 0,
        stress: checkin?.stressLevel ?? 5,
        workoutIntensity: metrics.workout ?? 0,
      },
      currentRisk: systemMetrics.risk,
      currentRecovery: systemMetrics.recovery,
    });
    const integrity: IntegrityPayload = {
      ...integrityComputed,
      hasActiveProtocol: Boolean(activeProtocol),
    };

    const sortedContributions = snapshot.contributions
      .map((line) => {
        const rawImpact = toNumber(line.contribution);
        const displayImpact = capDisplayImpact(rawImpact);
        return {
          statType: line.statType,
          factorType: line.factorType,
          contribution: displayImpact,
          impact: displayImpact,
          rawImpact,
        };
      })
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    const significantContributions = sortedContributions.filter((item) => Math.abs(item.impact) >= 0.1);
    const fallbackContributions = sortedContributions.slice(0, 3);
    const topContributions =
      significantContributions.length > 0 ? significantContributions.slice(0, 3) : fallbackContributions;

    const seriesRows7d = await prisma.statSnapshot.findMany({
      where: {
        userId: user.id,
        date: { in: recent7DayDates },
      },
      select: {
        date: true,
        lifeScore: true,
        health: true,
        relationships: true,
        career: true,
        finance: true,
        personalGrowth: true,
      },
    });

    const seriesRows30d = isPro
      ? await prisma.statSnapshot.findMany({
          where: {
            userId: user.id,
            date: { lte: date },
          },
          orderBy: { date: "desc" },
          take: 30,
          select: {
            date: true,
            lifeScore: true,
            health: true,
            relationships: true,
            career: true,
            finance: true,
            personalGrowth: true,
          },
        })
      : [];

    const seriesRowByDayKey = new Map(seriesRows7d.map((row) => [formatDateOnly(row.date), row]));
    const series7d = recent7DayKeys
      .map((dayKey) => {
        const row = seriesRowByDayKey.get(dayKey);
        if (!row) return null;
        return {
          date: dayKey,
          lifeScore: toNumber(row.lifeScore),
          stats: {
            energy: toNumber(row.health),
            focus: toNumber(row.relationships),
            discipline: toNumber(row.career),
            finance: toNumber(row.finance),
            growth: toNumber(row.personalGrowth),
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const series30d = Array.from(
      new Map(seriesRows30d.map((row) => [formatDateOnly(row.date), row])).values()
    )
      .map((row) => ({
        date: formatDateOnly(row.date),
        lifeScore: toNumber(row.lifeScore),
        stats: {
          energy: toNumber(row.health),
          focus: toNumber(row.relationships),
          discipline: toNumber(row.career),
          finance: toNumber(row.finance),
          growth: toNumber(row.personalGrowth),
        },
      }))
      .reverse();

    if (process.env.NODE_ENV === "development") {
      console.warn(`[control-room] trend dayKeys=${recent7DayKeys.join(",")} points=${series7d.length}`);
    }

    const totalCheckins = await prisma.dailyCheckIn.count({ where: { userId: user.id } });
    const resolvedStatus = resolveStatus(snapshot.systemStatus, toNumber(snapshot.lifeScore), series7d);

    requestTimer.end({ status: 200 });
    return NextResponse.json(
      {
        ok: true,
        data: {
          userId: user.id,
          totalCheckins,
          demoMode,
          isAdmin: isAdmin(user),
          plan: user.plan,
          featureAccess: {
            antiChaos: isPro,
            forecast30d: isPro,
            allStats: isPro,
            history: isPro,
          },
          todayCheckInExists: Boolean(todayCheckin),
          telemetry,
          checkinInputs: {
            deepWorkMin: Math.round(metrics.deepWorkMin ?? 0),
            workout: Math.round(clamp(metrics.workout ?? 0, 0, 1)),
            stress: Math.round(clamp(checkin?.stressLevel ?? 5, 1, 10)),
          },
          checkinSnapshot: checkin
            ? {
                date: formatDateOnly(checkin.date),
                sleepHours: metrics.sleepHours ?? null,
                sleepQuality: metrics.sleepQuality ?? null,
                deepWorkMin: metrics.deepWorkMin ?? null,
                learningMin: metrics.learningMin ?? null,
                stress: checkin.stressLevel ?? null,
                workout: metrics.workout ?? null,
                moneyDelta: metrics.moneyDelta ?? null,
              }
            : null,
          systemMetrics,
          diagnosis,
          executiveSummary,
          patterns,
          calibration,
          modelConfidence,
          guardrail: {
            ...guardrail,
            avgRisk14d: round1(avgRisk14d),
          },
          integrity,
          adaptiveBaseline: {
            riskOffset: Math.round((user.adaptiveRiskOffset ?? 0) * 10) / 10,
            recoveryOffset: Math.round((user.adaptiveRecoveryOffset ?? 0) * 10) / 10,
          },
          breakdown,
          date: formatDateOnly(snapshot.date),
          status: resolvedStatus,
          rawStatus: snapshot.systemStatus,
          snapshot: {
            id: snapshot.id,
            lifeScore: toNumber(snapshot.lifeScore),
            stats: {
              energy: toNumber(snapshot.health),
              focus: toNumber(snapshot.relationships),
              discipline: isPro ? toNumber(snapshot.career) : null,
              finance: isPro ? toNumber(snapshot.finance) : null,
              growth: isPro ? toNumber(snapshot.personalGrowth) : null,
            },
            configVersion: snapshot.configVersion,
          },
          topContributions,
          series7d,
          series30d,
          projection30d,
        },
      },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error) {
    requestTimer.end({ status: 500 });
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
