export type AntiChaosHorizonHours = 24 | 48 | 72;
export type TrainingMode = "off" | "light" | "normal";

export type AntiChaosActions = {
  sleepDeltaMin: 0 | 30 | 60 | 90;
  deepWorkCapMin: 0 | 30 | 60 | 90;
  stressDelta: 0 | -1 | -2;
  wakeAnchorShiftMin: 0 | -30 | -60;
  trainingMode: TrainingMode;
};

export type AntiChaosSeriesPoint = {
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

export type AntiChaosSystemMode = "stable" | "cycle" | "drift" | "overload";

export type AntiChaosPatternSignal = {
  type: string;
  severity: 0 | 1 | 2 | 3;
  confidence: number;
  suggestedLever: string;
};

export type AntiChaosProtocol = {
  userId: string;
  dateISO: string;
  horizonHours: AntiChaosHorizonHours;
  actions: AntiChaosActions;
  impact: {
    baselineAtHorizon: {
      lifeScore: number;
      risk: number;
      burnout: number;
    };
    protocolAtHorizon: {
      lifeScore: number;
      risk: number;
      burnout: number;
    };
    deltas: {
      lifeScore: number;
      risk: number;
      burnout: number;
    };
  };
  series: {
    baseline: AntiChaosSeriesPoint[];
    protocol: AntiChaosSeriesPoint[];
    horizonDays: number;
  };
  why: {
    primaryDriver: string;
    secondaryDriver?: string;
    summary: string;
  };
  detected: {
    pattern: string;
    confidence: number;
  };
  patternInfluence: {
    systemMode: AntiChaosSystemMode;
    applied: boolean;
  };
  brief: {
    mainPriority: string;
    secondary: [string, string];
    mandatoryRecovery: string;
    wakeAnchorMinutes?: number;
    cutList: string[];
    expectedEffects: {
      Energy: number;
      Focus: number;
      risk: number;
      lifeScore: number;
      burnout: number;
    };
  };
};
