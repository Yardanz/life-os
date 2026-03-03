type IntegrityEvent = {
  timestamp: string;
  type: string;
  message?: string;
};

export type IntegrityRecentItem = {
  title: string;
  timestamp: Date | null;
  detail: string | null;
  status: "VIOLATION" | "DRIFT";
};

export type IntegritySummary = {
  violations24h: number | null;
  lastViolationAt: Date | null;
  recent: IntegrityRecentItem[];
};

function extractDetail(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const separators = [":", "-", "—"];
  for (const separator of separators) {
    const parts = trimmed.split(separator);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return parts[0].trim();
    }
  }
  return null;
}

export function deriveIntegritySummary({
  violations,
  events,
  now = new Date(),
}: {
  violations: string[];
  events: IntegrityEvent[];
  now?: Date;
}): IntegritySummary {
  const integrityEvents = events
    .filter((event) => event.type.includes("INTEGRITY"))
    .map((event) => ({ ...event, ts: new Date(event.timestamp) }))
    .filter((event) => Number.isFinite(event.ts.getTime()))
    .sort((a, b) => b.ts.getTime() - a.ts.getTime());

  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const violations24h =
    integrityEvents.length > 0
      ? integrityEvents.filter((event) => nowMs - event.ts.getTime() <= dayMs).length
      : null;
  const lastViolationAt = integrityEvents.length > 0 ? integrityEvents[0].ts : null;

  const recentFromViolations: IntegrityRecentItem[] = violations.slice(0, 5).map((violation, index) => ({
    title: violation,
    timestamp: integrityEvents[index]?.ts ?? null,
    detail: extractDetail(violation),
    status: "VIOLATION",
  }));

  if (recentFromViolations.length > 0) {
    return { violations24h, lastViolationAt, recent: recentFromViolations };
  }

  return {
    violations24h,
    lastViolationAt,
    recent: integrityEvents.slice(0, 5).map((event) => ({
      title: event.message ?? "Integrity drift detected.",
      timestamp: event.ts,
      detail: null,
      status: "DRIFT",
    })),
  };
}
