export type GuardrailInput = {
  currentRisk: number;
  avgRisk14d: number;
  burnout: number;
  confidence: number;
  adaptiveRiskOffset: number;
};

export type GuardrailResult = {
  level: 0 | 1 | 2;
  label: "OPEN" | "CAUTION" | "LOCKDOWN";
  reasons: string[];
};

export function evaluateGuardrail(input: GuardrailInput): GuardrailResult {
  const reasonsL2: string[] = [];
  if (input.currentRisk >= 85) {
    reasonsL2.push(`currentRisk>=85 (${input.currentRisk.toFixed(1)})`);
  }
  if (input.avgRisk14d >= 75 && input.adaptiveRiskOffset > 8) {
    reasonsL2.push(
      `avgRisk14d>=75 (${input.avgRisk14d.toFixed(1)}) and adaptiveRiskOffset>8 (${input.adaptiveRiskOffset.toFixed(1)})`
    );
  }
  if (input.burnout >= 70) {
    reasonsL2.push(`burnout>=70 (${input.burnout.toFixed(1)})`);
  }
  if (input.confidence < 0.35 && input.currentRisk >= 70) {
    reasonsL2.push(
      `confidence<0.35 (${input.confidence.toFixed(2)}) and currentRisk>=70 (${input.currentRisk.toFixed(1)})`
    );
  }
  if (reasonsL2.length > 0) {
    return {
      level: 2,
      label: "LOCKDOWN",
      reasons: reasonsL2,
    };
  }

  const reasonsL1: string[] = [];
  if (input.currentRisk >= 70) {
    reasonsL1.push(`currentRisk>=70 (${input.currentRisk.toFixed(1)})`);
  }
  if (input.avgRisk14d >= 60) {
    reasonsL1.push(`avgRisk14d>=60 (${input.avgRisk14d.toFixed(1)})`);
  }
  if (input.adaptiveRiskOffset >= 5) {
    reasonsL1.push(`adaptiveRiskOffset>=5 (${input.adaptiveRiskOffset.toFixed(1)})`);
  }
  if (input.confidence < 0.5) {
    reasonsL1.push(`confidence<0.50 (${input.confidence.toFixed(2)})`);
  }
  if (reasonsL1.length > 0) {
    return {
      level: 1,
      label: "CAUTION",
      reasons: reasonsL1,
    };
  }

  return {
    level: 0,
    label: "OPEN",
    reasons: [],
  };
}

