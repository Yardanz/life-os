export type DirectiveGuardrail = "OPEN" | "CAUTION" | "LOCKDOWN" | string;
export type DirectiveIntegrity = "STABLE" | "DRIFT" | "STRAIN" | string;
export type DirectiveCalibrationStage = "CALIBRATING" | "STABILIZED";

export type DirectiveProtocol = {
  horizonHours?: number;
  constraints?: Array<{ label: string; value: string; severity?: "hard" | "soft" | string }>;
} | null;

export type BuildDirectivesInput = {
  guardrailState: DirectiveGuardrail;
  activeProtocol: DirectiveProtocol;
  integrityState: DirectiveIntegrity | null;
  calibrationStage: DirectiveCalibrationStage;
};

export function buildDirectives(input: BuildDirectivesInput): string[] {
  const { guardrailState, activeProtocol, integrityState, calibrationStage } = input;

  if (!activeProtocol) {
    return ["No active protocol. Generate and apply constraints to enable directives."];
  }

  const directives: string[] = [];

  if (calibrationStage === "CALIBRATING") {
    directives.push("Calibration conservative - keep load within baseline.");
  }

  if (guardrailState === "LOCKDOWN") {
    directives.push("Suspend non-essential load.");
    directives.push("Recovery-first operation until risk drops.");
    directives.push("Re-evaluate in 6-12h.");
  } else if (guardrailState === "CAUTION") {
    directives.push("Reduce discretionary load to stay within caps.");
    directives.push("Prioritize recovery inputs (sleep, regulation).");
    directives.push("Re-evaluate in 12-24h.");
  } else {
    directives.push("Maintain operation within configured caps.");
    directives.push("Re-evaluate after next check-in.");
  }

  if (integrityState === "STRAIN") {
    directives.push("Compliance drift detected - enforce constraints strictly.");
  }

  return directives.slice(0, 5);
}

