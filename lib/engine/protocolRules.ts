export type ProtocolState = "OPEN" | "CAUTION" | "LOCKDOWN";
export type ProtocolMode = "STANDARD" | "STABILIZE";

export type ProtocolObject = {
  title: string;
  horizonHours: number;
  state: ProtocolState;
  mode: ProtocolMode;
  constraints: Array<{ label: string; value: string; severity: "hard" | "soft" }>;
  allowed: Array<{ label: string; note?: string }>;
  minRecovery: Array<{ label: string; value: string }>;
  reEvaluation: { afterHours: number; triggers: string[] };
  rationale: string[];
};

export function buildProtocol(args: {
  guardrailState: ProtocolState;
  mode: ProtocolMode;
  risk: number;
  recovery: number;
  load: number;
  confidence: number;
  horizonHours: number;
}): ProtocolObject {
  const { guardrailState, mode, risk, recovery, load, confidence, horizonHours } = args;
  const rationale = [
    `Mode: ${mode}`,
    `Guardrail state: ${guardrailState}`,
    `Risk ${risk.toFixed(1)} | Recovery ${recovery.toFixed(1)} | Load ${load.toFixed(1)}`,
  ];

  if (confidence < 0.6) {
    rationale.push("Calibration stage - constraints conservative");
  }

  if (guardrailState === "LOCKDOWN" && mode === "STABILIZE") {
    return {
      title: `${horizonHours}h Protocol - LOCKDOWN STABILIZE`,
      horizonHours,
      state: "LOCKDOWN",
      mode,
      constraints: [
        { label: "No intense training", value: "Mandatory", severity: "hard" },
        { label: "No deep work blocks", value: "Mandatory", severity: "hard" },
        { label: "Meetings cap", value: "Max 1/day", severity: "hard" },
      ],
      allowed: [
        { label: "Recovery-only day" },
        { label: "Low-stimulus tasks" },
      ],
      minRecovery: [
        { label: "Sleep", value: ">= 9-10h" },
        { label: "Naps", value: "Allowed" },
        { label: "Wind-down", value: "Strict" },
      ],
      reEvaluation: {
        afterHours: risk > 80 ? 3 : 6,
        triggers: ["Risk increase", "Sleep below target", "Stress spike"],
      },
      rationale,
    };
  }

  if (guardrailState === "LOCKDOWN") {
    return {
      title: `${horizonHours}h Protocol - LOCKDOWN`,
      horizonHours,
      state: "LOCKDOWN",
      mode,
      constraints: [
        { label: "No intense training", value: "Mandatory", severity: "hard" },
        { label: "No deep work blocks", value: "Mandatory", severity: "hard" },
        { label: "Meetings cap", value: "Max 2/day", severity: "soft" },
      ],
      allowed: [
        { label: "Recovery-only day" },
        { label: "Low-stimulus tasks" },
      ],
      minRecovery: [
        { label: "Sleep", value: ">= 8-9h" },
        { label: "Naps", value: "Allowed" },
        { label: "Wind-down", value: "Strict" },
      ],
      reEvaluation: {
        afterHours: risk > 80 ? 6 : 12,
        triggers: ["Risk increase", "Sleep below target", "Stress spike"],
      },
      rationale,
    };
  }

  if (guardrailState === "CAUTION" && mode === "STABILIZE") {
    return {
      title: `${horizonHours}h Protocol - CAUTION STABILIZE`,
      horizonHours,
      state: "CAUTION",
      mode,
      constraints: [
        { label: "No intense training", value: "Mandatory", severity: "hard" },
        { label: "Deep work cap", value: "30-60m", severity: "hard" },
        { label: "Meetings cap", value: "Max 3/day", severity: "soft" },
      ],
      allowed: [
        { label: "Admin tasks" },
        { label: "Low-stimulus tasks" },
      ],
      minRecovery: [
        { label: "Sleep", value: ">= 9h" },
        { label: "Outdoor", value: "45m" },
        { label: "Pre-bed screens", value: "Off 90m" },
      ],
      reEvaluation: {
        afterHours: risk > 60 ? 6 : 12,
        triggers: ["Risk above 60", "Recovery below 60", "Guardrail escalation"],
      },
      rationale,
    };
  }

  if (guardrailState === "CAUTION") {
    return {
      title: `${horizonHours}h Protocol - CAUTION`,
      horizonHours,
      state: "CAUTION",
      mode,
      constraints: [
        { label: "Deep work cap", value: "60-90m", severity: "hard" },
        { label: "No late caffeine", value: "After 14:00 blocked", severity: "soft" },
        { label: "Training", value: "Light only", severity: "hard" },
      ],
      allowed: [
        { label: "Admin tasks" },
        { label: "Low-cog work blocks" },
      ],
      minRecovery: [
        { label: "Sleep", value: ">= 8h" },
        { label: "Outdoor", value: "45m" },
        { label: "Pre-bed screens", value: "Off 60m" },
      ],
      reEvaluation: {
        afterHours: risk > 60 ? 12 : 24,
        triggers: ["Risk above 60", "Recovery below 60", "Guardrail escalation"],
      },
      rationale,
    };
  }

  if (mode === "STABILIZE") {
    return {
      title: `${horizonHours}h Protocol - OPEN STABILIZE`,
      horizonHours,
      state: "OPEN",
      mode,
      constraints: [
        { label: "Deep work cap", value: "60-90m", severity: "hard" },
        { label: "No late caffeine", value: "After 14:00 blocked", severity: "soft" },
        { label: "Training", value: "Light only", severity: "hard" },
      ],
      allowed: [
        { label: "Admin tasks" },
        { label: "Low-cog work blocks" },
      ],
      minRecovery: [
        { label: "Sleep", value: ">= 8h" },
        { label: "Walk", value: "45m" },
      ],
      reEvaluation: {
        afterHours: 12,
        triggers: ["Risk drift", "Recovery drop", "Stress > 7"],
      },
      rationale,
    };
  }

  return {
    title: `${horizonHours}h Protocol - OPEN`,
    horizonHours,
    state: "OPEN",
    mode,
    constraints: [
      { label: "Avoid overload spikes", value: "Required", severity: "soft" },
      { label: "Keep stress", value: "<= 7", severity: "hard" },
      { label: "Deep work cap", value: "120m", severity: "soft" },
    ],
    allowed: [
      { label: "Normal workload" },
      { label: "Training", note: "OK if recovery > 60" },
    ],
    minRecovery: [
      { label: "Sleep", value: ">= 7h" },
      { label: "Walk", value: "30m" },
    ],
    reEvaluation: {
      afterHours: 24,
      triggers: ["Risk drift", "Recovery drop", "Stress > 7"],
    },
    rationale,
  };
}
