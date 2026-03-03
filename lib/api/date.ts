import { ApiError } from "@/lib/api/errors";
import { getUtcISODate } from "@/lib/date/getUtcISODate";

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function toUtcDateOnly(value: string): Date {
  if (!isIsoDate(value)) {
    throw new ApiError(400, "Invalid date format. Use YYYY-MM-DD.");
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function todayUtcDateOnly(): Date {
  return toUtcDateOnly(getUtcISODate());
}

export function formatDateOnly(date: Date): string {
  return getUtcISODate(date);
}
