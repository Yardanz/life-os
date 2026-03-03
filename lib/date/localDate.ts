const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalISODate(date: Date = new Date()): string {
  return formatISODate(date);
}

export function parseISODateParam(value: string | null | undefined): string | null {
  if (!value) return null;
  return ISO_DATE_PATTERN.test(value) ? value : null;
}

export function addDaysISO(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  return formatISODate(next);
}

// Temporary aliases for compatibility while moving to explicit ISO helper names.
export const parseDateParam = parseISODateParam;
export const addDays = addDaysISO;
