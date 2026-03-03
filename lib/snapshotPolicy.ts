export type SnapshotPayloadInput = Record<string, unknown>;

export type SanitizedSnapshotPayload = {
  capturedAt: string;
  lifeScore: number | null;
  guardrailState: string | null;
  load: number | null;
  recovery: number | null;
  risk: number | null;
  confidence: number | null;
  integrity: { score: number | null; state: string | null } | null;
  protocolSummary: {
    state: string | null;
    horizonHours: number | null;
    mode: string | null;
    constraintsCount: number | null;
  } | null;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized.slice(0, 64) : null;
}

function asIso(value: unknown): string {
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const intValue = Math.trunc(value);
  if (intValue < 0) return null;
  return intValue;
}

export function allowedSnapshotPayload(payload: SnapshotPayloadInput): SanitizedSnapshotPayload {
  const integrityRaw = payload.integrity;
  const protocolRaw = payload.protocolSummary;

  const integrity =
    integrityRaw && typeof integrityRaw === "object"
      ? {
          score: asFiniteNumber((integrityRaw as Record<string, unknown>).score),
          state: asString((integrityRaw as Record<string, unknown>).state),
        }
      : null;

  const protocolSummary =
    protocolRaw && typeof protocolRaw === "object"
      ? {
          state: asString((protocolRaw as Record<string, unknown>).state),
          horizonHours: asNonNegativeInt((protocolRaw as Record<string, unknown>).horizonHours),
          mode: asString((protocolRaw as Record<string, unknown>).mode),
          constraintsCount: asNonNegativeInt((protocolRaw as Record<string, unknown>).constraintsCount),
        }
      : null;

  return {
    capturedAt: asIso(payload.capturedAt),
    lifeScore: asFiniteNumber(payload.lifeScore),
    guardrailState: asString(payload.guardrailState),
    load: asFiniteNumber(payload.load),
    recovery: asFiniteNumber(payload.recovery),
    risk: asFiniteNumber(payload.risk),
    confidence: asFiniteNumber(payload.confidence),
    integrity,
    protocolSummary,
  };
}
