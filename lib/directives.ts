export type DirectiveInput = {
  guardrailState: "OPEN" | "CAUTION" | "LOCKDOWN" | string;
  hasActiveProtocol: boolean;
  protocolMode?: "STANDARD" | "STABILIZE" | string | null;
  protocolHorizonHours?: number | null;
  integrityState?: "STABLE" | "DRIFT" | "STRAIN" | string | null;
  calibrationStage?: "CALIBRATING" | "STABILIZED" | string | null;
};

export function buildDirectives(input: DirectiveInput): string[] {
  if (!input.hasActiveProtocol) {
    return [
      "No active protocol.",
      "Generate and apply constraints to enable directives.",
      "Next check-in required to update state.",
    ];
  }

  const directives: string[] = [];

  if (input.calibrationStage === "CALIBRATING") {
    directives.push("Calibration conservative - keep load within baseline.");
  }

  if (input.guardrailState === "LOCKDOWN") {
    directives.push("Suspend non-essential load.");
    directives.push("Recovery-first operation until risk drops.");
    directives.push("Re-evaluate within 6-12h.");
  } else if (input.guardrailState === "CAUTION") {
    directives.push("Reduce discretionary load to stay within caps.");
    directives.push("Prioritize recovery inputs (sleep, regulation).");
    directives.push("Re-evaluate within 12-24h.");
  } else {
    directives.push("Operate within configured caps.");
    directives.push("Avoid unnecessary volatility.");
  }

  if (input.protocolMode === "STABILIZE") {
    directives.push("Stabilize mode active - minimize variance.");
  }

  if (input.integrityState === "STRAIN") {
    directives.push("Compliance strain - enforce constraints strictly.");
  } else if (input.integrityState === "DRIFT") {
    directives.push("Compliance drift - tighten adherence.");
  }

  directives.push("Next check-in required to update state.");

  return directives.slice(0, 6);
}

