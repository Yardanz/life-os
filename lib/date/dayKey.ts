export const DEFAULT_TZ_OFFSET_MINUTES = 180;

export function clampTzOffsetMinutes(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TZ_OFFSET_MINUTES;
  return Math.max(-12 * 60, Math.min(14 * 60, Math.trunc(value)));
}

export function getDayKeyAtOffset(date: Date = new Date(), tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES): string {
  const offset = clampTzOffsetMinutes(tzOffsetMinutes);
  const shifted = new Date(date.getTime() + offset * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeNextCheckinCountdown(now: Date = new Date(), tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES): {
  hours: number;
  minutes: number;
  label: string;
} {
  const offset = clampTzOffsetMinutes(tzOffsetMinutes);
  const shiftedNow = new Date(now.getTime() + offset * 60_000);
  const nextLocalMidnightShifted = Date.UTC(
    shiftedNow.getUTCFullYear(),
    shiftedNow.getUTCMonth(),
    shiftedNow.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  const diffMs = Math.max(0, nextLocalMidnightShifted - shiftedNow.getTime());
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    hours,
    minutes,
    label: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  };
}

export function dayKeyToUtcDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getRecentDayKeysAtOffset(args: {
  anchor: Date;
  days: number;
  tzOffsetMinutes?: number;
}): string[] {
  const { anchor, days, tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES } = args;
  const safeDays = Math.max(1, Math.trunc(days));
  const offset = clampTzOffsetMinutes(tzOffsetMinutes);
  const anchorKey = getDayKeyAtOffset(anchor, offset);
  const [year, month, day] = anchorKey.split("-").map(Number);
  const baseUtc = new Date(Date.UTC(year, month - 1, day));
  const keys: string[] = [];

  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const next = new Date(baseUtc);
    next.setUTCDate(baseUtc.getUTCDate() - i);
    const y = next.getUTCFullYear();
    const m = String(next.getUTCMonth() + 1).padStart(2, "0");
    const d = String(next.getUTCDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${d}`);
  }

  return keys;
}
