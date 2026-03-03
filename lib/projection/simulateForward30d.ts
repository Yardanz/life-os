import { computeDayV3 } from "@/lib/scoring/engine";
import type { CalibrationProfile } from "@/lib/calibration/personalCalibration";
import type {
  DailyCheckInInput,
  PreviousBioStateInput,
  PreviousSnapshotInput,
  WeightConfigInput,
} from "@/lib/scoring/types";
import { createSeededRandom } from "@/lib/projection/prng";
import { applyRateLimiter, getRateLimiterCaps, type SimulationStep } from "@/lib/projection/rateLimiter";

export type ProjectionScenario = "BASELINE" | "STABILIZATION" | "OVERLOAD";

export type ProjectionAvgInputs = {
  sleepHours: number;
  sleepQuality: number;
  bedtimeMinutes?: number;
  wakeTimeMinutes?: number;
  deepWorkMinutes: number;
  learningMinutes: number;
  stressLevel: number;
  workoutRate: number;
  moneyDelta: number;
  sleepRegularity: number;
  cognitiveSaturation: number;
  circadianAlignmentPenalty?: number;
  regularityPenalty?: number;
};

export type ProjectionDayPoint = {
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
};

export type ProjectionResult = {
  days: ProjectionDayPoint[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function softSaturate(value: number, limit = 120): number {
  if (value <= limit) return value;
  return limit - (value - limit) * 0.5;
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

function applyScenarioInputs(
  avgInputs: ProjectionAvgInputs,
  scenario: ProjectionScenario
): ProjectionAvgInputs {
  if (scenario === "STABILIZATION") {
    return {
      ...avgInputs,
      sleepHours: Math.max(avgInputs.sleepHours, 7.5),
      sleepQuality: clamp(avgInputs.sleepQuality + 0.5, 1, 5),
      deepWorkMinutes: avgInputs.deepWorkMinutes * 0.8,
      learningMinutes: avgInputs.learningMinutes * 0.9,
      stressLevel: avgInputs.stressLevel * 0.8,
    };
  }

  if (scenario === "OVERLOAD") {
    return {
      ...avgInputs,
      sleepHours: avgInputs.sleepHours * 0.95,
      sleepQuality: clamp(avgInputs.sleepQuality - 0.3, 1, 5),
      deepWorkMinutes: avgInputs.deepWorkMinutes * 1.15,
      learningMinutes: avgInputs.learningMinutes * 1.1,
      stressLevel: avgInputs.stressLevel * 1.15,
    };
  }

  return avgInputs;
}

export function simulateForward30d(params: {
  userId: string;
  startDate: Date;
  seedSalt?: string;
  step?: SimulationStep;
  inertiaStart?: {
    risk?: number;
    burnoutRisk?: number;
    strain?: number;
  };
  initialBioState: PreviousBioStateInput;
  initialStatsSnapshot: PreviousSnapshotInput;
  avgInputs: ProjectionAvgInputs;
  scenario: ProjectionScenario;
  config: WeightConfigInput;
  previousSnapshot?: PreviousSnapshotInput;
  previousBioState?: PreviousBioStateInput;
  previousLifeScores?: number[];
  calibration?: CalibrationProfile;
}): ProjectionResult {
  const scenarioInputs = applyScenarioInputs(params.avgInputs, params.scenario);
  const random = createSeededRandom(
    `${params.userId}:${params.scenario}:${params.startDate.toISOString().slice(0, 10)}:${params.seedSalt ?? ""}`
  );
  const caps = getRateLimiterCaps(params.step ?? "DAILY");
  const days: ProjectionDayPoint[] = [];

  let previousSnapshot = params.initialStatsSnapshot;
  let previousPreviousSnapshot = params.previousSnapshot;
  let prevBioState = params.initialBioState;
  let prevPrevBioState = params.previousBioState;
  let prevRisk =
    typeof params.inertiaStart?.risk === "number" ? clamp(params.inertiaStart.risk, 0, 100) : null;
  let prevBurnout =
    typeof params.inertiaStart?.burnoutRisk === "number"
      ? clamp(params.inertiaStart.burnoutRisk, 0, 100)
      : clamp(params.initialBioState.burnoutRiskIndex, 0, 100);
  let prevStrain =
    typeof params.inertiaStart?.strain === "number"
      ? clamp(params.inertiaStart.strain, 0, 100)
      : clamp(params.initialBioState.strainIndex, 0, 100);
  const lifeScores = [...(params.previousLifeScores ?? []), params.initialStatsSnapshot.lifeScore];

  for (let dateOffset = 1; dateOffset <= 30; dateOffset += 1) {
    const date = new Date(params.startDate);
    date.setUTCDate(date.getUTCDate() + dateOffset);

    const workout = random() < clamp(scenarioInputs.workoutRate, 0, 1) ? 1 : 0;
    const checkIn: DailyCheckInInput = {
      date,
      sleepHours: clamp(scenarioInputs.sleepHours, 0, 12),
      sleepQuality: clamp(scenarioInputs.sleepQuality, 1, 5),
      bedtimeMinutes: typeof scenarioInputs.bedtimeMinutes === "number" ? clamp(Math.round(scenarioInputs.bedtimeMinutes), 0, 1439) : undefined,
      wakeTimeMinutes: typeof scenarioInputs.wakeTimeMinutes === "number" ? clamp(Math.round(scenarioInputs.wakeTimeMinutes), 0, 1439) : undefined,
      deepWorkMin: Math.max(0, scenarioInputs.deepWorkMinutes),
      learningMin: Math.max(0, scenarioInputs.learningMinutes),
      stress: clamp(scenarioInputs.stressLevel, 1, 10),
      workout: workout as 0 | 1,
      moneyDelta: scenarioInputs.moneyDelta,
      sleepRegularity: clamp(scenarioInputs.sleepRegularity, 0, 100),
      cognitiveSaturation: clamp(scenarioInputs.cognitiveSaturation, 0, 100),
      circadianAlignmentPenalty: clamp(scenarioInputs.circadianAlignmentPenalty ?? 0, 0, 100),
      regularityPenalty: clamp(scenarioInputs.regularityPenalty ?? 0, 0, 12),
    };

    const result = computeDayV3({
      checkIn,
      previousSnapshot,
      previousPreviousSnapshot,
      prevBioState,
      prevPrevBioState,
      config: params.config,
      previousLifeScores: lifeScores.slice(-7),
      calibration: params.calibration
        ? {
            calibrationActive: params.calibration.calibrationActive,
            confidence: params.calibration.confidence,
            multipliers: params.calibration.multipliers,
          }
        : undefined,
    });

    const rawRisk = clamp(result.risk, 0, 100);
    const rawBurnout = clamp(result.nextBioState.burnoutRiskIndex, 0, 100);
    const rawStrain = clamp(result.nextBioState.strainIndex, 0, 100);

    const stabilizedRisk = prevRisk === null ? rawRisk : applyRateLimiter(prevRisk, rawRisk, caps.risk);
    const stabilizedBurnout = applyRateLimiter(prevBurnout, rawBurnout, caps.burnout);
    const stabilizedStrain = applyRateLimiter(prevStrain, rawStrain, caps.strain);

    days.push({
      dateOffset,
      lifeScore: Math.round(clamp(result.lifeScore, 0, 100) * 10) / 10,
      risk: Math.round(stabilizedRisk * 10) / 10,
      burnoutRisk: Math.round(stabilizedBurnout * 10) / 10,
      energy: Math.round(clamp(result.stats.Energy, 0, 100) * 10) / 10,
      focus: Math.round(clamp(result.stats.Focus, 0, 100) * 10) / 10,
      strain: Math.round(stabilizedStrain * 10) / 10,
      recoveryDebt: Math.round(clamp(result.nextBioState.recoveryDebt, 0, 100) * 10) / 10,
      circadianPenalty: Math.round(clamp(100 - result.nextBioState.circadianAlignment, 0, 100) * 10) / 10,
      stressLevel: Math.round(clamp(checkIn.stress, 1, 10) * 10) / 10,
    });

    previousPreviousSnapshot = previousSnapshot;
    previousSnapshot = {
      date,
      lifeScore: result.lifeScore,
      stats: result.stats,
    };
    prevPrevBioState = prevBioState;
    prevBioState = sanitizeBioState({
      ...result.nextBioState,
      burnoutRiskIndex: stabilizedBurnout,
      strainIndex: stabilizedStrain,
    });
    prevRisk = stabilizedRisk;
    prevBurnout = stabilizedBurnout;
    prevStrain = stabilizedStrain;
    lifeScores.push(result.lifeScore);
  }

  return { days };
}
