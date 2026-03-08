export type GuardrailInput = {
  currentRisk: number;
  avgRisk14d: number;
  burnout: number;
  confidence: number;
  adaptiveRiskOffset: number;
  // Optional cumulative stress signals. If present, they are folded into deterministic control pressure.
  recoveryDebt?: number | null;
  adaptiveCapacity?: number | null;
  resilience?: number | null;
  overloadLevel?: number | null;
  lifeScore?: number | null;
  lifeScoreDelta7d?: number | null;
  riskDelta7d?: number | null;
  burnoutDelta7d?: number | null;
  load?: number | null;
  recovery?: number | null;
  recoveryPattern?: {
    streakDays: number;
    strength: number;
  } | null;
};

export type GuardrailResult = {
  level: 0 | 1 | 2;
  label: "OPEN" | "CAUTION" | "LOCKDOWN";
  reasons: string[];
};

export type GuardrailDebugContext = {
  controlPressureScore: number;
  controlPressureAfterRelief: number;
  recoveryReliefScore: number;
  recoveryReasons: string[];
  severeSignalCount: number;
  pressureReasons: string[];
  emergencyReasons: string[];
  emergencyTriggered: boolean;
};

export type GuardrailResultWithContext = GuardrailResult & {
  context: GuardrailDebugContext;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFiniteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function evaluateGuardrailInternal(input: GuardrailInput): GuardrailResultWithContext {
  const currentRisk = clamp(input.currentRisk, 0, 100);
  const avgRisk14d = clamp(input.avgRisk14d, 0, 100);
  const burnout = clamp(input.burnout, 0, 100);
  const confidence = clamp(input.confidence, 0, 1);
  const adaptiveRiskOffset = toFiniteOrNull(input.adaptiveRiskOffset) ?? 0;

  const recoveryDebt = toFiniteOrNull(input.recoveryDebt);
  const adaptiveCapacity = toFiniteOrNull(input.adaptiveCapacity);
  const resilience = toFiniteOrNull(input.resilience);
  const overloadLevel = toFiniteOrNull(input.overloadLevel);
  const lifeScore = toFiniteOrNull(input.lifeScore);
  const lifeScoreDelta7d = toFiniteOrNull(input.lifeScoreDelta7d);
  const riskDelta7d = toFiniteOrNull(input.riskDelta7d);
  const burnoutDelta7d = toFiniteOrNull(input.burnoutDelta7d);
  const load = toFiniteOrNull(input.load);
  const recovery = toFiniteOrNull(input.recovery);
  const recoveryPatternStreakDays = Math.max(0, Math.round(toFiniteOrNull(input.recoveryPattern?.streakDays) ?? 0));
  const recoveryPatternStrength = clamp(toFiniteOrNull(input.recoveryPattern?.strength) ?? 0, 0, 1);
  const sustainedRecoveryWindow =
    recoveryPatternStreakDays >= 4 &&
    recoveryPatternStrength >= 0.58 &&
    (riskDelta7d == null || riskDelta7d <= -2) &&
    (burnoutDelta7d == null || burnoutDelta7d <= -1.5) &&
    (lifeScoreDelta7d == null || lifeScoreDelta7d >= 1);

  let controlPressure = 0;
  let severeSignals = 0;
  const pressureReasons: string[] = [];
  const emergencyReasons: string[] = [];
  const recoveryReasons: string[] = [];

  const addPressure = (score: number, reason: string) => {
    controlPressure += score;
    pressureReasons.push(reason);
    if (score >= 2) severeSignals += 1;
  };

  if (currentRisk >= 72) {
    addPressure(3, `currentRisk>=72 (${currentRisk.toFixed(1)})`);
  } else if (currentRisk >= 64) {
    addPressure(2, `currentRisk>=64 (${currentRisk.toFixed(1)})`);
  } else if (currentRisk >= 56) {
    addPressure(1, `currentRisk>=56 (${currentRisk.toFixed(1)})`);
  }

  const avgRiskSevereThreshold =
    sustainedRecoveryWindow
      ? 72
      : recoveryPatternStreakDays >= 4 && recoveryPatternStrength >= 0.55
        ? 69
        : 65;
  const avgRiskModerateThreshold =
    sustainedRecoveryWindow
      ? 62
      : recoveryPatternStreakDays >= 4 && recoveryPatternStrength >= 0.55
        ? 60
        : 56;
  if (avgRisk14d >= avgRiskSevereThreshold) {
    addPressure(2, `avgRisk14d>=${avgRiskSevereThreshold} (${avgRisk14d.toFixed(1)})`);
  } else if (avgRisk14d >= avgRiskModerateThreshold) {
    addPressure(1, `avgRisk14d>=${avgRiskModerateThreshold} (${avgRisk14d.toFixed(1)})`);
  }

  if (burnout >= 76) {
    addPressure(3, `burnout>=76 (${burnout.toFixed(1)})`);
  } else if (burnout >= 68) {
    addPressure(2, `burnout>=68 (${burnout.toFixed(1)})`);
  } else if (burnout >= 58) {
    addPressure(1, `burnout>=58 (${burnout.toFixed(1)})`);
  }

  if (typeof recoveryDebt === "number") {
    if (recoveryDebt >= 70) {
      addPressure(2, `recoveryDebt>=70 (${recoveryDebt.toFixed(1)})`);
    } else if (recoveryDebt >= 55) {
      addPressure(1, `recoveryDebt>=55 (${recoveryDebt.toFixed(1)})`);
    }
  }

  if (typeof adaptiveCapacity === "number") {
    if (adaptiveCapacity <= 34) {
      addPressure(2, `adaptiveCapacity<=34 (${adaptiveCapacity.toFixed(1)})`);
    } else if (adaptiveCapacity <= 44) {
      addPressure(1, `adaptiveCapacity<=44 (${adaptiveCapacity.toFixed(1)})`);
    }
  }

  if (typeof resilience === "number") {
    if (resilience <= 34) {
      addPressure(2, `resilience<=34 (${resilience.toFixed(1)})`);
    } else if (resilience <= 44) {
      addPressure(1, `resilience<=44 (${resilience.toFixed(1)})`);
    }
  }

  if (typeof overloadLevel === "number") {
    if (overloadLevel >= 2) {
      addPressure(3, `overloadLevel>=2 (${Math.round(overloadLevel)})`);
    } else if (overloadLevel >= 1) {
      addPressure(1, `overloadLevel>=1 (${Math.round(overloadLevel)})`);
    }
  }

  if (typeof lifeScore === "number") {
    if (lifeScore <= 34) {
      addPressure(2, `lifeScore<=34 (${lifeScore.toFixed(1)})`);
    } else if (lifeScore <= 44) {
      addPressure(1, `lifeScore<=44 (${lifeScore.toFixed(1)})`);
    }
  }

  if (typeof lifeScoreDelta7d === "number") {
    if (lifeScoreDelta7d <= -6) {
      addPressure(2, `lifeScoreDelta7d<=-6 (${lifeScoreDelta7d.toFixed(1)})`);
    } else if (lifeScoreDelta7d <= -3) {
      addPressure(1, `lifeScoreDelta7d<=-3 (${lifeScoreDelta7d.toFixed(1)})`);
    }
  }

  if (typeof riskDelta7d === "number") {
    if (riskDelta7d >= 12) {
      addPressure(2, `riskDelta7d>=12 (${riskDelta7d.toFixed(1)})`);
    } else if (riskDelta7d >= 6) {
      addPressure(1, `riskDelta7d>=6 (${riskDelta7d.toFixed(1)})`);
    }
  }

  if (typeof burnoutDelta7d === "number") {
    if (burnoutDelta7d >= 10) {
      addPressure(2, `burnoutDelta7d>=10 (${burnoutDelta7d.toFixed(1)})`);
    } else if (burnoutDelta7d >= 5) {
      addPressure(1, `burnoutDelta7d>=5 (${burnoutDelta7d.toFixed(1)})`);
    }
  }

  if (typeof load === "number" && typeof recovery === "number") {
    const imbalance = load - recovery;
    if (imbalance >= 15) {
      addPressure(2, `load-recovery>=15 (${imbalance.toFixed(1)})`);
    } else if (imbalance >= 8) {
      addPressure(1, `load-recovery>=8 (${imbalance.toFixed(1)})`);
    }
  }

  if (adaptiveRiskOffset >= 8 && avgRisk14d >= (sustainedRecoveryWindow ? 68 : 62)) {
    addPressure(
      1,
      `adaptiveRiskOffset>=8 (${adaptiveRiskOffset.toFixed(1)}) with avgRisk14d=${avgRisk14d.toFixed(1)}`
    );
  }

  if (confidence < 0.4 && currentRisk >= 68) {
    addPressure(2, `confidence<0.40 (${confidence.toFixed(2)}) and currentRisk>=68 (${currentRisk.toFixed(1)})`);
  } else if (confidence < 0.5 && currentRisk >= 60) {
    addPressure(1, `confidence<0.50 (${confidence.toFixed(2)}) and currentRisk>=60 (${currentRisk.toFixed(1)})`);
  }

  let recoveryRelief = 0;
  const addRelief = (score: number, reason: string) => {
    recoveryRelief += score;
    recoveryReasons.push(reason);
  };
  if (recoveryPatternStreakDays >= 3 && recoveryPatternStrength >= 0.45) {
    addRelief(0.8, `recoveryPattern>=3d (${recoveryPatternStreakDays}d @ ${recoveryPatternStrength.toFixed(2)})`);
  }
  if (recoveryPatternStreakDays >= 4 && recoveryPatternStrength >= 0.55) {
    addRelief(1.1, `recoveryPattern>=4d (${recoveryPatternStreakDays}d @ ${recoveryPatternStrength.toFixed(2)})`);
  }
  if (recoveryPatternStreakDays >= 6 && recoveryPatternStrength >= 0.65) {
    addRelief(1.3, `recoveryPattern>=6d (${recoveryPatternStreakDays}d @ ${recoveryPatternStrength.toFixed(2)})`);
  }
  if (typeof riskDelta7d === "number" && riskDelta7d <= -4) {
    addRelief(0.55, `riskDelta7d<=-4 (${riskDelta7d.toFixed(1)})`);
  }
  if (typeof burnoutDelta7d === "number" && burnoutDelta7d <= -4) {
    addRelief(0.55, `burnoutDelta7d<=-4 (${burnoutDelta7d.toFixed(1)})`);
  }
  if (typeof load === "number" && typeof recovery === "number" && recovery >= load + 4) {
    addRelief(0.45, `recovery-load>=4 (${(recovery - load).toFixed(1)})`);
  }
  if (typeof lifeScoreDelta7d === "number" && lifeScoreDelta7d >= 2.5) {
    addRelief(0.35, `lifeScoreDelta7d>=2.5 (${lifeScoreDelta7d.toFixed(1)})`);
  }
  if (sustainedRecoveryWindow) {
    addRelief(
      0.4,
      `sustained_recovery_window (${recoveryPatternStreakDays}d @ ${recoveryPatternStrength.toFixed(2)})`
    );
    if (avgRisk14d <= 74) {
      addRelief(0.35, `avgRisk14d_relief<=74 (${avgRisk14d.toFixed(1)})`);
    }
    if (currentRisk <= 72 && burnout <= 76) {
      addRelief(0.35, `current_risk_burnout_relief (risk=${currentRisk.toFixed(1)}, burnout=${burnout.toFixed(1)})`);
    }
  }
  const recoveryReliefScore = clamp(recoveryRelief, 0, 3.6);
  const controlPressureAfterRelief = Math.max(0, controlPressure - recoveryReliefScore);
  const strongRecoveryRelief = recoveryReliefScore >= 1.6 && recoveryPatternStreakDays >= 4;
  const protectiveRecoveryRelief = recoveryReliefScore >= 2.2 && recoveryPatternStreakDays >= 6;

  const emergencyRiskThreshold = strongRecoveryRelief ? 92 : 88;
  const emergencyBurnoutThreshold = strongRecoveryRelief ? 88 : 82;
  if (currentRisk >= emergencyRiskThreshold) {
    emergencyReasons.push(`currentRisk>=${emergencyRiskThreshold} (${currentRisk.toFixed(1)})`);
  }
  if (burnout >= emergencyBurnoutThreshold) {
    emergencyReasons.push(`burnout>=${emergencyBurnoutThreshold} (${burnout.toFixed(1)})`);
  }
  const overloadEmergencyThreshold = strongRecoveryRelief ? 78 : 72;
  if (typeof overloadLevel === "number" && overloadLevel >= 2 && (currentRisk >= overloadEmergencyThreshold || burnout >= overloadEmergencyThreshold)) {
    emergencyReasons.push(
      `overloadLevel>=2 (${Math.round(overloadLevel)}) with high risk/burnout (risk=${currentRisk.toFixed(1)}, burnout=${burnout.toFixed(1)})`
    );
  }
  const emergencyDebtThreshold = strongRecoveryRelief ? 85 : 80;
  const emergencyAdaptiveThreshold = strongRecoveryRelief ? 26 : 30;
  if (typeof recoveryDebt === "number" && typeof adaptiveCapacity === "number" && recoveryDebt >= emergencyDebtThreshold && adaptiveCapacity <= emergencyAdaptiveThreshold) {
    emergencyReasons.push(
      `recoveryDebt>=${emergencyDebtThreshold} (${recoveryDebt.toFixed(1)}) and adaptiveCapacity<=${emergencyAdaptiveThreshold} (${adaptiveCapacity.toFixed(1)})`
    );
  }
  const lockdownPressureThreshold = sustainedRecoveryWindow ? 13.8 : strongRecoveryRelief ? 13.2 : 12.5;
  const lockdownSevereSignalsRequired = sustainedRecoveryWindow ? 3 : 2;
  if (
    controlPressureAfterRelief >= lockdownPressureThreshold &&
    severeSignals >= lockdownSevereSignalsRequired &&
    !protectiveRecoveryRelief
  ) {
    emergencyReasons.push(
      `controlPressure>=${lockdownPressureThreshold.toFixed(1)} (${controlPressureAfterRelief.toFixed(1)} after relief) with stacked severe signals (${severeSignals})`
    );
  }

  if (emergencyReasons.length > 0) {
    return {
      level: 2,
      label: "LOCKDOWN",
      reasons: emergencyReasons.slice(0, 4),
      context: {
        controlPressureScore: Math.round(controlPressure * 10) / 10,
        controlPressureAfterRelief: Math.round(controlPressureAfterRelief * 10) / 10,
        recoveryReliefScore: Math.round(recoveryReliefScore * 10) / 10,
        recoveryReasons: recoveryReasons.slice(0, 10),
        severeSignalCount: severeSignals,
        pressureReasons: pressureReasons.slice(0, 10),
        emergencyReasons: emergencyReasons.slice(0, 10),
        emergencyTriggered: true,
      },
    };
  }

  const cautionPressureThresholdBase = recoveryReliefScore >= 2 ? 5.1 : recoveryReliefScore >= 1 ? 4.6 : 4;
  const cautionRiskThresholdBase = recoveryReliefScore >= 2 ? 67 : recoveryReliefScore >= 1 ? 65 : 62;
  const cautionAvgRiskThresholdBase = recoveryReliefScore >= 2 ? 63 : recoveryReliefScore >= 1 ? 61 : 58;
  const cautionPressureThreshold = cautionPressureThresholdBase + (sustainedRecoveryWindow ? 0.6 : 0);
  const cautionRiskThreshold = cautionRiskThresholdBase + (sustainedRecoveryWindow ? 2 : 0);
  const cautionAvgRiskThreshold = cautionAvgRiskThresholdBase + (sustainedRecoveryWindow ? 2 : 0);
  if (controlPressureAfterRelief >= cautionPressureThreshold || currentRisk >= cautionRiskThreshold || avgRisk14d >= cautionAvgRiskThreshold) {
    const cautionReasons = [...pressureReasons];
    cautionReasons.unshift(`controlPressure=${controlPressureAfterRelief.toFixed(1)} (after relief)`);
    if (recoveryReasons.length > 0) {
      cautionReasons.push(`recoveryRelief=${recoveryReliefScore.toFixed(1)}`);
    }
    return {
      level: 1,
      label: "CAUTION",
      reasons: cautionReasons.slice(0, 5),
      context: {
        controlPressureScore: Math.round(controlPressure * 10) / 10,
        controlPressureAfterRelief: Math.round(controlPressureAfterRelief * 10) / 10,
        recoveryReliefScore: Math.round(recoveryReliefScore * 10) / 10,
        recoveryReasons: recoveryReasons.slice(0, 10),
        severeSignalCount: severeSignals,
        pressureReasons: pressureReasons.slice(0, 10),
        emergencyReasons: [],
        emergencyTriggered: false,
      },
    };
  }

  return {
    level: 0,
    label: "OPEN",
    reasons: [],
    context: {
      controlPressureScore: Math.round(controlPressure * 10) / 10,
      controlPressureAfterRelief: Math.round(controlPressureAfterRelief * 10) / 10,
      recoveryReliefScore: Math.round(recoveryReliefScore * 10) / 10,
      recoveryReasons: recoveryReasons.slice(0, 10),
      severeSignalCount: severeSignals,
      pressureReasons: pressureReasons.slice(0, 10),
      emergencyReasons: [],
      emergencyTriggered: false,
    },
  };
}

export function evaluateGuardrail(input: GuardrailInput): GuardrailResult {
  const { level, label, reasons } = evaluateGuardrailInternal(input);
  return { level, label, reasons };
}

export function evaluateGuardrailWithContext(input: GuardrailInput): GuardrailResultWithContext {
  return evaluateGuardrailInternal(input);
}
