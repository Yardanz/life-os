import { evaluateGuardrail } from "@/lib/guardrails/guardrailEngine";
import {
  buildRiskEnvelopeScenarioInputs,
  type RiskEnvelopeContext,
  simulateRiskEnvelope72h,
} from "@/lib/projection/riskEnvelope";
import type { ProjectionAvgInputs } from "@/lib/projection/simulateForward30d";

export type DecisionBudget72h = {
  allowableLoadDelta: number;
  allowableStressDelta: number;
  maxWorkoutIntensity: number;
  safeWindowHours: number;
};

type BreachKind = "NONE" | "CAUTION" | "CRITICAL" | "LOCKDOWN" | "INVALID";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function sanitizeNonNegativeFinite(value: number): number {
  if (!isFiniteNumber(value) || value < 0) return 0;
  return value;
}

function zeroBudget(safeWindowHours = 0): DecisionBudget72h {
  return {
    allowableLoadDelta: 0,
    allowableStressDelta: 0,
    maxWorkoutIntensity: 0,
    safeWindowHours: clamp(Math.round(safeWindowHours), 0, 72),
  };
}

function findMaxDeltaUntilBreach(
  runEnvelope: (delta: number) => { hasBreach: boolean },
  args: {
    maxDelta: number;
    coarseStep: number;
    precision: number;
    maxIterations?: number;
  }
): number {
  const zero = runEnvelope(0);
  if (zero.hasBreach) return 0;

  if (!(args.maxDelta > 0) || !(args.coarseStep > 0) || !(args.precision > 0)) return 0;

  let lastSafe = 0;
  let breachAt: number | null = null;
  const coarseLimit = Math.ceil(args.maxDelta / args.coarseStep) + 1;
  for (let i = 1; i <= coarseLimit; i += 1) {
    const delta = Math.min(i * args.coarseStep, args.maxDelta);
    if (runEnvelope(delta).hasBreach) {
      breachAt = delta;
      break;
    }
    lastSafe = delta;
    if (delta >= args.maxDelta) break;
  }

  if (breachAt === null) return round1(args.maxDelta);

  let low = lastSafe;
  let high = breachAt;
  const maxIterations = args.maxIterations ?? 30;
  for (let i = 0; i < maxIterations; i += 1) {
    if (high - low <= args.precision) break;
    const mid = (low + high) / 2;
    if (runEnvelope(mid).hasBreach) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return round1(low);
}

function evaluate72hRun(args: {
  context: RiskEnvelopeContext;
  avgInputs: ProjectionAvgInputs;
  avgRisk14d: number;
  confidence: number;
  adaptiveRiskOffset: number;
  seedSalt: string;
}): {
  hasBreach: boolean;
  safeWindowHours: number;
  breachKind: BreachKind;
} {
  const hours = [0, 24, 48, 72];
  const { riskByHour, burnoutByHour } = simulateRiskEnvelope72h({
    context: args.context,
    avgInputs: args.avgInputs,
    seedSalt: args.seedSalt,
  });

  const riskHistoryRaw = Array.from({ length: 14 }, () =>
    clamp(args.avgRisk14d - args.adaptiveRiskOffset, 0, 100)
  );
  let safeWindowHours = 72;
  let hasBreach = false;
  let breachKind: BreachKind = "NONE";

  for (let i = 0; i < hours.length; i += 1) {
    const riskRaw = riskByHour[i] ?? riskByHour[riskByHour.length - 1];
    const burnoutRaw =
      burnoutByHour[i] ?? burnoutByHour[burnoutByHour.length - 1] ?? args.context.currentBio.burnoutRiskIndex;
    if (!isFiniteNumber(riskRaw ?? Number.NaN) || !isFiniteNumber(burnoutRaw ?? Number.NaN)) {
      hasBreach = true;
      breachKind = "INVALID";
      safeWindowHours = i === 0 ? 0 : safeWindowHours;
      break;
    }
    const risk = clamp(riskRaw ?? 0, 0, 100);
    const burnout = clamp(burnoutRaw ?? 0, 0, 100);
    if (i > 0) {
      riskHistoryRaw.push(risk);
      while (riskHistoryRaw.length > 14) {
        riskHistoryRaw.shift();
      }
    }
    const avgRisk14dProjectedRaw =
      riskHistoryRaw.length > 0
        ? riskHistoryRaw.reduce((sum, value) => sum + value, 0) / riskHistoryRaw.length
        : risk;
    const avgRisk14dProjected = clamp(avgRisk14dProjectedRaw + args.adaptiveRiskOffset, 0, 100);
    const riskDelta7dProjected =
      riskHistoryRaw.length >= 8 ? risk - riskHistoryRaw[Math.max(0, riskHistoryRaw.length - 8)] : 0;
    const guardrail = evaluateGuardrail({
      currentRisk: risk,
      avgRisk14d: avgRisk14dProjected,
      burnout,
      confidence: args.confidence,
      adaptiveRiskOffset: args.adaptiveRiskOffset,
      recoveryDebt: args.context.currentBio.recoveryDebt,
      adaptiveCapacity: args.context.currentBio.adaptiveCapacity,
      resilience: args.context.currentBio.resilienceIndex,
      overloadLevel: args.context.currentBio.overloadLevel,
      riskDelta7d: riskDelta7dProjected,
      burnoutDelta7d: burnout - args.context.currentBio.burnoutRiskIndex,
    });

    if (safeWindowHours === 72 && (risk >= 65 || guardrail.level >= 1)) {
      safeWindowHours = hours[i];
    }
    if (guardrail.level === 2) {
      hasBreach = true;
      breachKind = "LOCKDOWN";
      break;
    }
    if (risk >= 80) {
      hasBreach = true;
      breachKind = "CRITICAL";
      break;
    }
    if (risk >= 65) {
      hasBreach = true;
      breachKind = "CAUTION";
      break;
    }
  }

  return {
    hasBreach,
    safeWindowHours,
    breachKind,
  };
}

export function computeDecisionBudget72h(args: {
  context: RiskEnvelopeContext;
  avgRisk14d: number;
  confidence: number;
  adaptiveRiskOffset: number;
}): DecisionBudget72h {
  const { baselineInputs } = buildRiskEnvelopeScenarioInputs(
    args.context.baseAvgInputs,
    args.context.baselineWorkoutRate
  );
  const baselineSeedSalt = "decision72h:baseline";

  const baselineRun = evaluate72hRun({
    context: args.context,
    avgInputs: baselineInputs,
    avgRisk14d: args.avgRisk14d,
    confidence: args.confidence,
    adaptiveRiskOffset: args.adaptiveRiskOffset,
    seedSalt: baselineSeedSalt,
  });
  if (baselineRun.hasBreach) {
    return zeroBudget(0);
  }

  const allowableLoadDelta = findMaxDeltaUntilBreach(
    (delta) =>
      evaluate72hRun({
        context: args.context,
        avgInputs: {
          ...baselineInputs,
          deepWorkMinutes: clamp(baselineInputs.deepWorkMinutes + delta, 0, 360),
        },
        avgRisk14d: args.avgRisk14d,
        confidence: args.confidence,
        adaptiveRiskOffset: args.adaptiveRiskOffset,
        seedSalt: baselineSeedSalt,
      }),
    {
      maxDelta: 50,
      coarseStep: 2,
      precision: 0.5,
      maxIterations: 30,
    }
  );

  const allowableStressDelta = findMaxDeltaUntilBreach(
    (delta) =>
      evaluate72hRun({
        context: args.context,
        avgInputs: {
          ...baselineInputs,
          stressLevel: clamp(baselineInputs.stressLevel + delta, 1, 10),
        },
        avgRisk14d: args.avgRisk14d,
        confidence: args.confidence,
        adaptiveRiskOffset: args.adaptiveRiskOffset,
        seedSalt: baselineSeedSalt,
      }),
    {
      maxDelta: 50,
      coarseStep: 2,
      precision: 0.5,
      maxIterations: 30,
    }
  );

  const workoutDelta = findMaxDeltaUntilBreach(
    (delta) =>
      evaluate72hRun({
        context: args.context,
        avgInputs: {
          ...baselineInputs,
          workoutRate: clamp(baselineInputs.workoutRate + delta, 0, 1),
        },
        avgRisk14d: args.avgRisk14d,
        confidence: args.confidence,
        adaptiveRiskOffset: args.adaptiveRiskOffset,
        seedSalt: baselineSeedSalt,
      }),
    {
      maxDelta: 1,
      coarseStep: 0.1,
      precision: 0.05,
      maxIterations: 30,
    }
  );

  return {
    allowableLoadDelta: round1(sanitizeNonNegativeFinite(allowableLoadDelta)),
    allowableStressDelta: round1(sanitizeNonNegativeFinite(allowableStressDelta)),
    maxWorkoutIntensity: round1(
      sanitizeNonNegativeFinite(clamp(baselineInputs.workoutRate + workoutDelta, 0, 1))
    ),
    safeWindowHours: clamp(Math.round(sanitizeNonNegativeFinite(baselineRun.safeWindowHours)), 0, 72),
  };
}
