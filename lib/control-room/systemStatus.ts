export type SystemStatus = "STABLE" | "STRAINED" | "DEGRADED" | "RECOVERY";

export type DeriveSystemStatusInput = {
  guardrailState: "OPEN" | "CAUTION" | "LOCKDOWN" | string;
  integrityState: "STABLE" | "DRIFT" | "STRAIN" | string | null;
  hasActiveProtocol: boolean;
  risk24h: number | null;
  modelConfidence: number | null;
  calibrationStage: "CALIBRATING" | "STABILIZED" | string;
};

export type DeriveSystemStatusResult = {
  status: SystemStatus;
  rationale: string[];
};

function normalizePercent(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 1 && value >= 0) return value * 100;
  return Math.max(0, Math.min(100, value));
}

// UI authority layer only: this classification does not modify engine math or signals.
export function deriveSystemStatus(input: DeriveSystemStatusInput): DeriveSystemStatusResult {
  const rationale: string[] = [];
  const confidencePct = normalizePercent(input.modelConfidence);

  let status: SystemStatus;
  if (input.guardrailState === "LOCKDOWN") {
    status = "DEGRADED";
    rationale.push("Guardrail LOCKDOWN active.");
  } else if (input.integrityState === "STRAIN") {
    status = "STRAINED";
    rationale.push("Integrity strain detected.");
  } else if (input.guardrailState === "CAUTION") {
    status = "STRAINED";
    rationale.push("Guardrail CAUTION active.");
  } else if (input.calibrationStage === "CALIBRATING" && (confidencePct ?? 0) < 75) {
    status = "RECOVERY";
    rationale.push("Calibration incomplete; limited authority.");
  } else {
    status = "STABLE";
    rationale.push("Guardrail OPEN with stable integrity.");
  }

  if (!input.hasActiveProtocol) {
    rationale.push("No active protocol; constraints not enforced.");
  }

  const riskPct = normalizePercent(input.risk24h);
  if (riskPct != null && riskPct >= 60 && status !== "DEGRADED") {
    rationale.push("Risk remains elevated in 24h horizon.");
  }

  return { status, rationale: rationale.slice(0, 3) };
}

