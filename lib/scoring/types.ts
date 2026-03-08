export const STAT_NAMES = ["Energy", "Focus", "Discipline", "Finance", "Growth"] as const;
export type StatName = (typeof STAT_NAMES)[number];

export const FACTOR_NAMES = ["S", "W", "DW", "L", "M", "T"] as const;
export type FactorName = (typeof FACTOR_NAMES)[number];
export type ContributionFactorName = FactorName | "MOMENTUM" | "OVERLOAD";

export type SystemStatusKind = "Overloaded" | "Declining" | "Growth" | "Stable";

export type StatVector = Record<StatName, number>;
export type FactorVector = Record<FactorName, number>;

export interface DailyCheckInInput {
  date: Date;
  stress: number;
  sleepHours: number;
  sleepQuality: number;
  bedtimeMinutes?: number;
  wakeTimeMinutes?: number;
  workout: 0 | 1;
  deepWorkMin: number;
  learningMin: number;
  moneyDelta: number;
  sleepRegularity?: number;
  cognitiveSaturation?: number;
  circadianAlignmentPenalty?: number;
  regularityPenalty?: number;
}

export interface PreviousSnapshotInput {
  date: Date;
  stats: StatVector;
  lifeScore: number;
}

export interface PreviousBioStateInput {
  date: Date;
  energyReserve: number;
  cognitiveFatigue: number;
  strainIndex: number;
  overloadLevel: 0 | 1 | 2;
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
}

export interface StatFactorConfig {
  weight: number;
  lag: number;
}

export type StatFactorMatrix = Record<StatName, Record<FactorName, StatFactorConfig>>;
export type StatDecayConfig = Record<StatName, number>;

export interface OverloadPenaltyWeights {
  Energy: number;
  Focus: number;
  Discipline: number;
}

export interface BioConfigInput {
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
}

export interface WeightConfigInput {
  configVersion: number;
  overloadK: number;
  trendDelta: number;
  momentumWeight: number;
  decay: StatDecayConfig;
  factors: StatFactorMatrix;
  overloadPenaltyWeights: OverloadPenaltyWeights;
  bio: BioConfigInput;
}

export interface StatContributionLine {
  stat: StatName;
  factor: ContributionFactorName;
  lag: number;
  rawValue: number;
  weight: number;
  rawContribution: number;
  effectiveContribution: number;
  momentumContribution: number;
  contribution: number;
}

export interface OverloadPenaltyLine {
  stat: Extract<StatName, "Energy" | "Focus" | "Discipline">;
  coefficient: number;
  penalty: number;
}

export interface StatusInput {
  currentLifeScore: number;
  previousLifeScores: number[];
  trendDelta: number;
  currentStats: StatVector;
  previousStats: StatVector;
  load: number;
  stress: number;
}

export interface StatusResult {
  status: SystemStatusKind;
  trend: number;
  decliningStats: number;
}

export interface EngineInput {
  checkIn: DailyCheckInInput;
  previousSnapshot?: PreviousSnapshotInput;
  previousPreviousSnapshot?: PreviousSnapshotInput;
  prevBioState?: PreviousBioStateInput;
  prevPrevBioState?: PreviousBioStateInput;
  config: WeightConfigInput;
  previousLifeScores: number[];
  lifeScoreTrend?: number;
  controlLayer?: {
    protocol?: {
      active: boolean;
      mode: "STANDARD" | "STABILIZE";
      horizonHours?: number;
    };
    antiChaos?: {
      active: boolean;
      severity: "WARNING" | "CRITICAL";
      daysSinceActivation?: number;
    };
    recoveryPattern?: {
      streakDays: number;
      strength: number;
      reasons?: string[];
    };
  };
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
}

export interface EngineOutput {
  nextBioState: PreviousBioStateInput;
  stats: StatVector;
  lifeScore: number;
  load: number;
  recovery: number;
  risk: number;
  overload: number;
  status: SystemStatusKind;
  trend: number;
  contributions: StatContributionLine[];
  overloadPenalties: OverloadPenaltyLine[];
  configVersion: number;
}
