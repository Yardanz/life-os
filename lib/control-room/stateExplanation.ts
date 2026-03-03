export type ExplanationGuardrail = "OPEN" | "CAUTION" | "LOCKDOWN" | string;

export type ExplanationCheckinSnapshot = {
  sleepHours: number | null;
  sleepQuality: number | null;
  deepWorkMin: number | null;
  learningMin: number | null;
  stress: number | null;
  workout: number | null;
  moneyDelta: number | null;
} | null;

export type ExplanationActiveProtocol = {
  state: "OPEN" | "CAUTION" | "LOCKDOWN" | string;
  horizonHours: number;
  mode: "STANDARD" | "STABILIZE" | string;
} | null;

export type ExplanationIntegrity = {
  score: number;
  state: "STABLE" | "DRIFT" | "STRAIN" | string;
} | null;

export type StateExplanationInput = {
  guardrailState: ExplanationGuardrail;
  lifeScore: number | null;
  load: number | null;
  recovery: number | null;
  risk: number | null;
  confidence: number | null;
  calibrationCheckinsDone?: number | null;
  calibrationCheckinsNeeded?: number | null;
  lastCheckin: ExplanationCheckinSnapshot;
  activeProtocol: ExplanationActiveProtocol;
  integrity: ExplanationIntegrity;
  recentGuardrailTransition?: boolean;
  recommendedButNotActive?: boolean;
  activeConstraintViolations?: boolean;
};

export type StateExplanation = {
  title: string;
  lines: string[];
  drivers: string[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildStateExplanation(input: StateExplanationInput): StateExplanation {
  const lines: string[] = [];
  const drivers: string[] = [];

  const addLine = (line: string) => {
    if (line.trim().length === 0) return;
    if (lines.length >= 7) return;
    if (lines.includes(line)) return;
    lines.push(line);
  };
  const addDriver = (driver: string) => {
    if (driver.trim().length === 0) return;
    if (drivers.length >= 3) return;
    drivers.push(driver);
  };

  if (isFiniteNumber(input.risk)) {
    if (input.risk >= 65) {
      addLine(`Overload probability is above threshold (Risk: ${round1(input.risk)}).`);
    } else if (input.risk <= 30) {
      addLine(`Overload probability is currently contained (Risk: ${round1(input.risk)}).`);
    }
  }

  if (isFiniteNumber(input.recovery)) {
    if (input.recovery < 60) {
      addLine(`Recovery capacity is constrained (Recovery: ${round1(input.recovery)}).`);
    } else if (input.recovery >= 70) {
      addLine(`Recovery capacity is currently stable (Recovery: ${round1(input.recovery)}).`);
    }
  }

  if (isFiniteNumber(input.load)) {
    if (input.load >= 60) {
      addLine(`Load is elevated relative to current capacity (Load: ${round1(input.load)}).`);
    } else if (input.load <= 35) {
      addLine(`Load pressure is currently moderate (Load: ${round1(input.load)}).`);
    }
  }

  if (isFiniteNumber(input.lifeScore)) {
    addLine(`Current Life Score: ${round1(input.lifeScore)}.`);
  }

  if (isFiniteNumber(input.confidence)) {
    const confidencePct = Math.max(0, Math.min(100, Math.round(input.confidence * 100)));
    addLine(`Model confidence: ${confidencePct}%.`);
    if (input.confidence < 0.6) {
      addLine("Calibration stage - outputs are conservative.");
    }
  }

  const calibrationDoneRaw = input.calibrationCheckinsDone;
  const calibrationNeededRaw = input.calibrationCheckinsNeeded;
  const calibrationDone =
    typeof calibrationDoneRaw === "number" && Number.isFinite(calibrationDoneRaw)
      ? Math.max(0, Math.floor(calibrationDoneRaw))
      : null;
  const calibrationNeeded =
    typeof calibrationNeededRaw === "number" && Number.isFinite(calibrationNeededRaw)
      ? Math.max(1, Math.floor(calibrationNeededRaw))
      : 7;
  if (calibrationDone != null && calibrationDone > 0 && calibrationDone < calibrationNeeded) {
    addLine("Calibration stage - outputs are conservative.");
  }

  if (input.activeProtocol) {
    addLine(
      `Active protocol: ${input.activeProtocol.state} (${input.activeProtocol.horizonHours}h), mode ${input.activeProtocol.mode}.`
    );
  }

  if (input.integrity && isFiniteNumber(input.integrity.score) && input.integrity.score < 60) {
    addLine(`Compliance drift detected (Integrity: ${Math.round(Math.max(0, Math.min(100, input.integrity.score)))}%).`);
  }
  if (input.recentGuardrailTransition) {
    addLine("Recent guardrail transition detected.");
  }
  if (input.recommendedButNotActive) {
    addLine("Constraints are recommended but not active.");
  }
  if (input.activeConstraintViolations) {
    addLine("Active constraint violations detected.");
  }

  if (!input.lastCheckin) {
    addLine("No check-in data available. State is based on limited inputs.");
  } else {
    if (isFiniteNumber(input.lastCheckin.sleepHours) && input.lastCheckin.sleepHours < 7) {
      addDriver(`Sleep below baseline (${round1(input.lastCheckin.sleepHours)}h).`);
    }
    if (isFiniteNumber(input.lastCheckin.stress) && input.lastCheckin.stress >= 7) {
      addDriver(`Stress elevated (${Math.round(input.lastCheckin.stress)}/10).`);
    }
    if (isFiniteNumber(input.lastCheckin.deepWorkMin) && input.lastCheckin.deepWorkMin > 90) {
      addDriver(`Deep work high (${Math.round(input.lastCheckin.deepWorkMin)}m).`);
    }
    if (drivers.length === 0 && isFiniteNumber(input.lastCheckin.learningMin) && input.lastCheckin.learningMin > 60) {
      addDriver(`Learning load elevated (${Math.round(input.lastCheckin.learningMin)}m).`);
    }
    if (drivers.length === 0 && isFiniteNumber(input.lastCheckin.workout) && input.lastCheckin.workout > 0) {
      addDriver("Training load present in latest check-in.");
    }
  }

  return {
    title: `State Explanation - ${input.guardrailState}`,
    lines,
    drivers,
  };
}
