export type GlossaryEntry = {
  term: string;
  definition: string;
};

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    term: "Life Score",
    definition: "Current operating stability (0-100) derived from load, recovery, and risk.",
  },
  {
    term: "Guardrail",
    definition: "Protection state that tightens constraints when overload probability rises (OPEN/CAUTION/LOCKDOWN).",
  },
  {
    term: "Load",
    definition: "System pressure from workload and strain signals.",
  },
  {
    term: "Recovery",
    definition: "Available restoration capacity based on sleep and regulation.",
  },
  {
    term: "Risk",
    definition: "Overload probability within the next 24 hours.",
  },
  {
    term: "Protocol",
    definition: "Deterministic constraints generated from current state to keep operation within capacity.",
  },
  {
    term: "Stabilize",
    definition: "Tightened protocol mode used to stop drift and reduce overload risk.",
  },
  {
    term: "System Integrity",
    definition: "Compliance indicator: how closely operation matches the active protocol.",
  },
  {
    term: "Anti-Chaos",
    definition: "Constraint tightening layer that reduces volatility under unstable conditions.",
  },
  {
    term: "Operator License",
    definition: "Capability layer enabling forward simulation, scenarios, and extended horizons.",
  },
];
