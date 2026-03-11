type TimingMeta = Record<string, string | number | boolean | null | undefined>;

function shouldLogTimings(): boolean {
  return process.env.PERF_TIMING_LOG === "1";
}

function formatMeta(meta?: TimingMeta): string {
  if (!meta) return "";
  const pairs = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);
  return pairs.length > 0 ? ` ${pairs.join(" ")}` : "";
}

export function startTiming(label: string, meta?: TimingMeta) {
  const enabled = shouldLogTimings();
  const startedAt = Date.now();
  if (enabled) {
    console.warn(`[perf] start ${label}${formatMeta(meta)}`);
  }
  return {
    end(extraMeta?: TimingMeta) {
      if (!enabled) return;
      const elapsedMs = Date.now() - startedAt;
      console.warn(`[perf] end ${label} durationMs=${elapsedMs}${formatMeta({ ...meta, ...extraMeta })}`);
    },
  };
}
