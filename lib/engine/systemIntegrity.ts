export type IntegrityState = "STABLE" | "DRIFT" | "STRAIN";

export type IntegrityConstraint = {
  label: string;
  value: string;
  severity: "hard" | "soft";
};

export type ActiveIntegrityProtocol = {
  constraints: IntegrityConstraint[];
  riskAtApply?: number | null;
  requiredMinRecovery?: number | null;
};

export type IntegrityInputs = {
  deepWorkMinutes?: number | null;
  stress?: number | null;
  workoutIntensity?: "none" | "light" | "moderate" | "intense" | number | null;
};

export type IntegrityResult = {
  score: number;
  state: IntegrityState;
  violations: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseFirstNumber(value: string): number | null {
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMaxNumber(value: string): number | null {
  const matches = value.match(/-?\d+(\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const numbers = matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

function violatesConstraint(constraint: IntegrityConstraint, inputs: IntegrityInputs): string | null {
  const label = constraint.label.toLowerCase();
  const value = constraint.value.toLowerCase();

  if (label.includes("deep work cap")) {
    const cap = parseMaxNumber(constraint.value);
    const deepWork = inputs.deepWorkMinutes;
    if (cap !== null && typeof deepWork === "number" && Number.isFinite(deepWork) && deepWork > cap) {
      return `Deep work cap exceeded (${deepWork} > ${cap})`;
    }
    return null;
  }

  if (label.includes("keep stress")) {
    const limit = parseFirstNumber(constraint.value);
    const stress = inputs.stress;
    if (limit !== null && typeof stress === "number" && Number.isFinite(stress) && stress > limit) {
      return `Stress limit exceeded (${stress} > ${limit})`;
    }
    return null;
  }

  if (label.includes("training") && value.includes("light")) {
    const intensity = inputs.workoutIntensity;
    if (typeof intensity === "string") {
      if (intensity === "moderate" || intensity === "intense") {
        return "Training intensity exceeds light-only constraint";
      }
      return null;
    }
    if (typeof intensity === "number" && Number.isFinite(intensity) && intensity > 1) {
      return "Training intensity exceeds light-only constraint";
    }
    return null;
  }

  return null;
}

function deriveState(score: number): IntegrityState {
  if (score > 80) return "STABLE";
  if (score >= 60) return "DRIFT";
  return "STRAIN";
}

export function computeIntegrity(args: {
  activeProtocol: ActiveIntegrityProtocol | null;
  currentInputs: IntegrityInputs;
  currentRisk: number;
  currentRecovery: number;
}): IntegrityResult {
  const { activeProtocol, currentInputs, currentRisk, currentRecovery } = args;

  if (!activeProtocol) {
    return {
      score: 100,
      state: "STABLE",
      violations: [],
    };
  }

  let score = 100;
  const violations: string[] = [];
  let hardViolations = 0;
  let softViolations = 0;

  for (const constraint of activeProtocol.constraints) {
    const violation = violatesConstraint(constraint, currentInputs);
    if (!violation) continue;
    violations.push(violation);
    if (constraint.severity === "hard") {
      hardViolations += 1;
    } else {
      softViolations += 1;
    }
  }

  score -= hardViolations * 20;
  score -= softViolations * 10;

  if (
    typeof activeProtocol.riskAtApply === "number" &&
    Number.isFinite(activeProtocol.riskAtApply) &&
    currentRisk > activeProtocol.riskAtApply
  ) {
    score -= 10;
  }

  if (
    typeof activeProtocol.requiredMinRecovery === "number" &&
    Number.isFinite(activeProtocol.requiredMinRecovery) &&
    currentRecovery >= activeProtocol.requiredMinRecovery
  ) {
    score += 5;
  }

  const clampedScore = clamp(score, 0, 100);
  return {
    score: clampedScore,
    state: deriveState(clampedScore),
    violations,
  };
}

