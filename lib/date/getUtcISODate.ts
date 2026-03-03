export function getUtcISODate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getYesterdayUtcISODate(date: Date = new Date()): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - 1);
  return getUtcISODate(next);
}
