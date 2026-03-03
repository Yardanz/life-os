export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRisk(risk: number): number {
  if (!Number.isFinite(risk)) return 0;
  if (risk <= 1) return clamp(risk * 100, 0, 100);
  return clamp(risk, 0, 100);
}

export function toDisplayValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return value.toFixed(1);
}

export function formatDayTick(dayIndex: number): string {
  return `D${dayIndex}`;
}

export function formatDateLabel(dateISO: string): string {
  return dateISO;
}

export function diffDaysISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86400000);
}
