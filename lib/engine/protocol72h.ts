import type { DecisionBudget72h } from "@/lib/engine/decisionBudgetEngine";

export type Protocol72h = {
  mode: "OPEN" | "CAUTION" | "LOCKDOWN";
  loadLimit: number;
  stressLimit: number;
  workoutLimit: number;
  recommendedFocus: "stabilize" | "maintain" | "growth_restricted";
  notes: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function safeNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function envelopeTrendNote(envelope72h: Array<{ riskBaseline: number }> | null | undefined): string | null {
  if (!envelope72h || envelope72h.length < 2) return null;
  const first = envelope72h[0]?.riskBaseline;
  const last = envelope72h[envelope72h.length - 1]?.riskBaseline;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  const delta = last - first;
  if (delta >= 2) return "Baseline envelope trend: rising risk.";
  if (delta <= -2) return "Baseline envelope trend: declining risk.";
  return "Baseline envelope trend: stable.";
}

export function generate72hProtocol(args: {
  decisionBudget: DecisionBudget72h | null;
  guardrailLevel: 0 | 1 | 2;
  envelope72h?: Array<{ riskBaseline: number }> | null;
}): Protocol72h {
  const budget = args.decisionBudget;
  const load = clamp(safeNumber(budget?.allowableLoadDelta), 0, 1000);
  const stress = clamp(safeNumber(budget?.allowableStressDelta), 0, 1000);
  const workout = clamp(safeNumber(budget?.maxWorkoutIntensity), 0, 1);
  const trendNote = envelopeTrendNote(args.envelope72h);

  if (args.guardrailLevel === 2) {
    return {
      mode: "LOCKDOWN",
      loadLimit: 0,
      stressLimit: 0,
      workoutLimit: 0,
      recommendedFocus: "stabilize",
      notes: [
        "Reduce load immediately.",
        "Protect recovery capacity.",
        "Avoid overload scenarios.",
      ],
    };
  }

  if (args.guardrailLevel === 1) {
    return {
      mode: "CAUTION",
      loadLimit: round1(load * 0.7),
      stressLimit: round1(stress * 0.7),
      workoutLimit: round1(clamp(workout * 0.5, 0, 1)),
      recommendedFocus: "maintain",
      notes: trendNote ? [trendNote, "Operate below 72h budget limits."] : ["Operate below 72h budget limits."],
    };
  }

  return {
    mode: "OPEN",
    loadLimit: round1(load),
    stressLimit: round1(stress),
    workoutLimit: round1(clamp(workout, 0, 1)),
    recommendedFocus: "growth_restricted",
    notes: trendNote ? [trendNote, "Operate within 72h budget limits."] : ["Operate within 72h budget limits."],
  };
}
