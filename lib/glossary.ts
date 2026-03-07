export type GlossaryEntry = {
  term: string;
  definition: string;
};

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    term: "Life Score",
    definition: "Current system operating state on a 0-100 scale, recalculated from latest signals.",
  },
  {
    term: "Guardrail",
    definition: "Safety state that defines operating strictness: OPEN, CAUTION, or LOCKDOWN.",
  },
  {
    term: "Trajectory",
    definition: "Short-horizon direction of your system state based on recent check-ins.",
  },
  {
    term: "Advanced Trajectory",
    definition: "Operator-depth 30-day projection showing baseline, stabilization, and overload paths.",
  },
  {
    term: "System Diagnostics",
    definition: "Operational signal layer used to inspect recovery, load, risk, drift, and calibration state.",
  },
  {
    term: "Partial Diagnostics",
    definition: "Day 5 diagnostic layer with core signals and limited plan depth.",
  },
  {
    term: "Full Diagnostics",
    definition: "Day 7 diagnostic layer with deeper model detail, plan depth still depends on entitlement.",
  },
  {
    term: "Recovery Capacity",
    definition: "Current restorative headroom and ability to absorb strain.",
  },
  {
    term: "Load Pressure",
    definition: "Current operational demand being applied to the system.",
  },
  {
    term: "Risk Probability",
    definition: "Estimated overload risk under current conditions.",
  },
  {
    term: "System Drift",
    definition: "Deviation from stable operating patterns and protocol alignment.",
  },
  {
    term: "Calibration Status",
    definition: "Model readiness and confidence maturity while baseline is being stabilized.",
  },
  {
    term: "Stability State",
    definition: "Current stability classification from the model summary.",
  },
  {
    term: "Baseline Stabilization",
    definition: "Early calibration window (first 7 check-ins) used to establish a reliable baseline.",
  },
  {
    term: "System Evolution",
    definition: "Day-based unlock path that reveals capabilities at key calibration milestones.",
  },
  {
    term: "Protocol",
    definition: "Operational constraint set generated from current state to keep the system within capacity.",
  },
  {
    term: "Anti-Chaos",
    definition: "Protocol stabilization layer used to reduce volatility during unstable conditions.",
  },
  {
    term: "Full Model Analysis",
    definition: "Deep diagnostic view with model explanation, driver impacts, and risk mechanics.",
  },
  {
    term: "Observer Depth",
    definition: "Base access layer with monitoring and limited diagnostic depth.",
  },
  {
    term: "Operator Depth",
    definition: "Extended diagnostic and planning depth enabled by Operator License.",
  },
  {
    term: "Operator License",
    definition: "Paid entitlement that unlocks operator-depth diagnostics, advanced trajectory, and anti-chaos capabilities.",
  },
];
