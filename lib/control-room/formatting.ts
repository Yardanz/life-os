type DeltaView = {
  label: string;
  colorClass: string;
};

const FACTOR_LABELS: Record<string, string> = {
  SLEEP: "Sleep",
  WORKOUT: "Workout",
  DEEP_WORK: "Deep Work",
  LEARNING: "Learning",
  MONEY_DELTA: "Money Delta",
  STRESS: "Stress",
  OVERLOAD: "Overload",
  MOMENTUM: "Momentum",
  EXERCISE: "Workout",
  WORKLOAD: "Deep Work",
  ROUTINE: "Learning",
};

const STAT_LABELS: Record<string, string> = {
  ENERGY: "Energy",
  FOCUS: "Focus",
  DISCIPLINE: "Discipline",
  FINANCE: "Finance",
  GROWTH: "Growth",
  HEALTH: "Energy",
  RELATIONSHIPS: "Focus",
  CAREER: "Discipline",
  PERSONAL_GROWTH: "Growth",
};

export function formatDelta(delta: number, hasPreviousDay: boolean): DeltaView {
  if (!hasPreviousDay) {
    return { label: "Baseline", colorClass: "text-zinc-400" };
  }

  if (Math.abs(delta) < 0.05) {
    return { label: "Flat", colorClass: "text-zinc-300" };
  }

  if (delta > 0) {
    return { label: `Up +${delta.toFixed(1)}`, colorClass: "text-emerald-300" };
  }

  return { label: `Down ${delta.toFixed(1)}`, colorClass: "text-rose-300" };
}

export function formatFactorLabel(factorType: string, statType: string): string {
  const factor = FACTOR_LABELS[factorType] ?? factorType;
  const stat = STAT_LABELS[statType] ?? statType;
  return `${factor} -> ${stat}`;
}

export function formatContributionValue(value: number): {
  label: string;
  colorClass: string;
} {
  if (value > 0) {
    return { label: `+${value.toFixed(1)}`, colorClass: "text-emerald-300" };
  }
  if (value < 0) {
    return { label: value.toFixed(1), colorClass: "text-rose-300" };
  }
  return { label: "0.0", colorClass: "text-zinc-400" };
}
