export type RequiredActionStatus = "pending" | "done" | "blocked";

export type RequiredActionCta = {
  label: string;
  action: "go-protocol-generate" | "go-protocol-apply" | "go-checkin";
};

export type RequiredActionStep = {
  id: string;
  label: string;
  status: RequiredActionStatus;
  cta?: RequiredActionCta;
};

export type RequiredActionsInput = {
  guardrailState: "OPEN" | "CAUTION" | "LOCKDOWN" | string;
  hasActiveProtocol: boolean;
  hasRecommendedProtocol: boolean;
  hasRecentCheckIn?: boolean;
  calibrationStage: "CALIBRATING" | "STABILIZED" | string;
  readOnly: boolean;
};

export type RequiredActionsOutput = {
  steps: RequiredActionStep[];
  warningLine?: string;
  noteLine?: string;
  readOnlyLine?: string;
};

export function deriveRequiredActions(input: RequiredActionsInput): RequiredActionsOutput {
  const steps: RequiredActionStep[] = [];

  if (input.readOnly) {
    return {
      steps: [
        {
          id: "read-only",
          label: "Protocol actions unavailable in read-only session.",
          status: "blocked",
        },
      ],
      readOnlyLine: "Read-only session.",
    };
  }

  if (!input.hasActiveProtocol) {
    const generated = input.hasRecommendedProtocol;
    steps.push({
      id: "generate-protocol",
      label: "Generate protocol",
      status: generated ? "done" : "pending",
      cta: generated ? undefined : { label: "Go to Generate", action: "go-protocol-generate" },
    });
    steps.push({
      id: "apply-protocol",
      label: "Apply protocol",
      status: generated ? "pending" : "blocked",
      cta: generated ? { label: "Go to Apply", action: "go-protocol-apply" } : undefined,
    });
  } else {
    steps.push({
      id: "protocol-active",
      label: "Protocol active",
      status: "done",
    });
  }

  if (typeof input.hasRecentCheckIn === "boolean") {
    steps.push({
      id: "recent-checkin",
      label: "Record current check-in",
      status: input.hasRecentCheckIn ? "done" : "pending",
      cta: input.hasRecentCheckIn ? undefined : { label: "Open Check-in", action: "go-checkin" },
    });
  }

  return {
    steps: steps.slice(0, 3),
    warningLine:
      input.guardrailState === "LOCKDOWN" && !input.hasActiveProtocol
        ? "LOCKDOWN active. Constraints must be enforced."
        : undefined,
    noteLine:
      input.calibrationStage === "CALIBRATING"
        ? "Calibration in progress. Authority limited."
        : undefined,
  };
}

