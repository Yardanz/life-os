import type { DailyCheckInInput, FactorVector } from "@/lib/scoring/types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeDailyInputs(input: DailyCheckInInput, moneyScale = 2000): FactorVector {
  const sleepQuality = clamp(input.sleepQuality / 5, 0, 1);
  const s = clamp(input.sleepHours / 8, 0, 1) * sleepQuality;
  const w = input.workout ? 1 : 0;
  const dw = clamp(input.deepWorkMin / 120, 0, 1);
  const l = clamp(input.learningMin / 60, 0, 1);
  const m = Math.tanh(input.moneyDelta / moneyScale);
  const t = clamp(1 - (input.stress - 1) / 9, 0, 1);

  return {
    S: s,
    W: w,
    DW: dw,
    L: l,
    M: m,
    T: t,
  };
}
