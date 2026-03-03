type ObsScope = "api" | "action" | "ui";

type LogSystemErrorParams = {
  errorId: string;
  scope: ObsScope;
  name: string;
  message: string;
  userId?: string | null;
  path?: string;
  ts?: string;
  meta?: Record<string, unknown>;
};

let errorCounter = 0;
const MAX_BUFFERED_ERRORS = 500;

export type LoggedSystemError = {
  errorId: string;
  scope: ObsScope;
  name: string;
  message: string;
  userId: string | null;
  path?: string;
  ts: string;
  meta?: Record<string, string | number | boolean | null>;
};

const bufferedErrors: LoggedSystemError[] = [];

export function generateErrorId(): string {
  errorCounter = (errorCounter + 1) % 46656;
  const ts = Date.now().toString(36);
  const count = errorCounter.toString(36).padStart(3, "0");
  return `E${ts}${count}`.toUpperCase();
}

export function maskUserId(userId: string | null | undefined): string | null {
  if (!userId) return null;
  if (userId.length <= 10) return `${userId.slice(0, 2)}***${userId.slice(-2)}`;
  return `${userId.slice(0, 6)}***${userId.slice(-4)}`;
}

function sanitizePrimitive(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 160);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  return null;
}

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, string | number | boolean | null> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(meta)) {
    clean[key] = sanitizePrimitive(value);
  }
  return clean;
}

export function logSystemError(params: LogSystemErrorParams): void {
  const payload: LoggedSystemError = {
    errorId: params.errorId,
    scope: params.scope,
    name: params.name,
    message: params.message.slice(0, 240),
    userId: maskUserId(params.userId),
    path: params.path,
    ts: params.ts ?? new Date().toISOString(),
    meta: sanitizeMeta(params.meta),
  };
  console.error(JSON.stringify(payload));
  bufferedErrors.unshift(payload);
  if (bufferedErrors.length > MAX_BUFFERED_ERRORS) {
    bufferedErrors.length = MAX_BUFFERED_ERRORS;
  }
}

export function getRecentSystemErrors(options?: { since?: Date; limit?: number }): LoggedSystemError[] {
  const sinceMs = options?.since?.getTime() ?? Number.NEGATIVE_INFINITY;
  const limit = Math.max(1, Math.min(options?.limit ?? 10, 1000));
  return bufferedErrors
    .filter((entry) => {
      const tsMs = Date.parse(entry.ts);
      return Number.isFinite(tsMs) && tsMs >= sinceMs;
    })
    .slice(0, limit);
}

export function getSystemErrorCountSince(since: Date): number {
  const sinceMs = since.getTime();
  return bufferedErrors.reduce((count, entry) => {
    const tsMs = Date.parse(entry.ts);
    if (!Number.isFinite(tsMs)) return count;
    return tsMs >= sinceMs ? count + 1 : count;
  }, 0);
}
