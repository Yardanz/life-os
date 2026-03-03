export const CHECKIN_LIMITS = {
  sleepHours: { min: 0, max: 14, step: 0.1, defaultValue: 8 },
  sleepQuality: { min: 1, max: 5, step: 1, defaultValue: 4 },
  deepWorkMin: { min: 0, max: 360, step: 5, defaultValue: 0 },
  learningMin: { min: 0, max: 360, step: 5, defaultValue: 0 },
  stress: { min: 1, max: 10, step: 1, defaultValue: 5 },
  bedtimeMinutes: { min: 0, max: 1439, step: 1, defaultValue: 23 * 60 + 30 },
  wakeTimeMinutes: { min: 0, max: 1439, step: 1, defaultValue: 7 * 60 + 30 },
  moneyDelta: { min: -1_000_000, max: 1_000_000, step: 1, defaultValue: 0 },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function parseNumber(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim().replace(",", ".");
    if (!normalized) return Number.NaN;
    return Number(normalized);
  }
  return Number.NaN;
}

export function normalizeInteger(
  raw: unknown,
  limits: { min: number; max: number; step?: number; defaultValue: number }
): { value: number; adjusted: boolean } {
  const parsed = Number.parseInt(String(parseNumber(raw)), 10);
  const base = Number.isFinite(parsed) ? parsed : limits.defaultValue;
  const clamped = clamp(base, limits.min, limits.max);
  const step = limits.step ?? 1;
  const stepped = step > 1 ? Math.round(clamped / step) * step : clamped;
  const value = clamp(stepped, limits.min, limits.max);
  return { value, adjusted: value !== base };
}

export function normalizeFloat(
  raw: unknown,
  limits: { min: number; max: number; step?: number; defaultValue: number }
): { value: number; adjusted: boolean } {
  const parsed = parseNumber(raw);
  const base = Number.isFinite(parsed) ? parsed : limits.defaultValue;
  const clamped = clamp(base, limits.min, limits.max);
  const step = limits.step ?? 0;
  const stepped = step > 0 ? Math.round(clamped / step) * step : clamped;
  const precision = step > 0 && step < 1 ? String(step).split(".")[1]?.length ?? 1 : 2;
  const value = Number(stepped.toFixed(precision));
  return { value, adjusted: value !== base };
}

export function normalizeMoney(raw: unknown): { value: number; adjusted: boolean } {
  const parsed = Number.parseInt(String(parseNumber(raw)), 10);
  const base = Number.isFinite(parsed) ? parsed : CHECKIN_LIMITS.moneyDelta.defaultValue;
  const value = clamp(base, CHECKIN_LIMITS.moneyDelta.min, CHECKIN_LIMITS.moneyDelta.max);
  return { value, adjusted: value !== base };
}

export function normalizeCheckinCore(input: {
  sleepHours: unknown;
  sleepQuality: unknown;
  deepWorkMin: unknown;
  learningMin: unknown;
  stress: unknown;
  workout: unknown;
  moneyDelta: unknown;
  bedtimeMinutes?: unknown;
  wakeTimeMinutes?: unknown;
}) {
  const sleepHours = normalizeFloat(input.sleepHours, CHECKIN_LIMITS.sleepHours);
  const sleepQuality = normalizeInteger(input.sleepQuality, CHECKIN_LIMITS.sleepQuality);
  const deepWorkMin = normalizeInteger(input.deepWorkMin, CHECKIN_LIMITS.deepWorkMin);
  const learningMin = normalizeInteger(input.learningMin, CHECKIN_LIMITS.learningMin);
  const stress = normalizeInteger(input.stress, CHECKIN_LIMITS.stress);
  const bedtimeMinutes = normalizeInteger(
    input.bedtimeMinutes,
    CHECKIN_LIMITS.bedtimeMinutes
  );
  const wakeTimeMinutes = normalizeInteger(input.wakeTimeMinutes, CHECKIN_LIMITS.wakeTimeMinutes);
  const moneyDelta = normalizeMoney(input.moneyDelta);
  const workout = input.workout === true || input.workout === 1;

  return {
    values: {
      sleepHours: sleepHours.value,
      sleepQuality: sleepQuality.value,
      deepWorkMin: deepWorkMin.value,
      learningMin: learningMin.value,
      stress: stress.value,
      workout,
      moneyDelta: moneyDelta.value,
      bedtimeMinutes: bedtimeMinutes.value,
      wakeTimeMinutes: wakeTimeMinutes.value,
    },
    adjusted: {
      sleepHours: sleepHours.adjusted,
      sleepQuality: sleepQuality.adjusted,
      deepWorkMin: deepWorkMin.adjusted,
      learningMin: learningMin.adjusted,
      stress: stress.adjusted,
      moneyDelta: moneyDelta.adjusted,
      bedtimeMinutes: bedtimeMinutes.adjusted,
      wakeTimeMinutes: wakeTimeMinutes.adjusted,
    },
  };
}
