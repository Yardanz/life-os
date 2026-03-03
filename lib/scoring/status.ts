import type { StatusInput, StatusResult, SystemStatusKind } from "@/lib/scoring/types";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((acc, value) => acc + value, 0);
  return total / values.length;
}

export function resolveSystemStatus(input: StatusInput): StatusResult {
  const baseline = average(input.previousLifeScores.slice(0, 7));
  const trend = input.previousLifeScores.length > 0 ? input.currentLifeScore - baseline : 0;

  const decliningStats = (Object.keys(input.currentStats) as Array<keyof typeof input.currentStats>)
    .filter((stat) => input.currentStats[stat] < input.previousStats[stat]).length;

  const isOverloaded = input.currentStats.Energy < 35 && (input.load > 0.7 || input.stress >= 8);
  const isDeclining = trend < -input.trendDelta && decliningStats >= 2;
  const isGrowth =
    trend > input.trendDelta &&
    input.currentStats.Growth > input.previousStats.Growth &&
    input.currentStats.Discipline > input.previousStats.Discipline;

  let status: SystemStatusKind = "Stable";
  if (isOverloaded) {
    status = "Overloaded";
  } else if (isDeclining) {
    status = "Declining";
  } else if (isGrowth) {
    status = "Growth";
  }

  return { status, trend, decliningStats };
}
