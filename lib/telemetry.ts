type DayBucket = {
  dayKey: string;
  counts: Map<string, number>;
  logged: boolean;
};

const globalTelemetry = globalThis as unknown as {
  lifeOsTelemetryBucket?: DayBucket;
};

function getServerDayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ensureBucket(now: Date = new Date()): DayBucket {
  const dayKey = getServerDayKey(now);
  const existing = globalTelemetry.lifeOsTelemetryBucket;
  if (existing && existing.dayKey === dayKey) {
    return existing;
  }

  const next: DayBucket = {
    dayKey,
    counts: new Map<string, number>(),
    logged: false,
  };
  globalTelemetry.lifeOsTelemetryBucket = next;
  return next;
}

function toRecord(counts: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, count] of counts.entries()) {
    out[name] = count;
  }
  return out;
}

function shouldLogTelemetryCounts(): boolean {
  if (process.env.TELEMETRY_LOG === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function recordEvent(eventName: string): void {
  if (!eventName || !eventName.trim()) return;
  const bucket = ensureBucket();
  const current = bucket.counts.get(eventName) ?? 0;
  bucket.counts.set(eventName, current + 1);

  if (!bucket.logged && shouldLogTelemetryCounts()) {
    bucket.logged = true;
    console.warn(`TELEMETRY dayKey=${bucket.dayKey} counts=${JSON.stringify(toRecord(bucket.counts))}`);
  }
}

export function getSnapshot(): { dayKey: string; counts: Record<string, number> } {
  const bucket = ensureBucket();
  return {
    dayKey: bucket.dayKey,
    counts: toRecord(bucket.counts),
  };
}
