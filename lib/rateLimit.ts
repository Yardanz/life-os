type RateBucket = {
  hits: number[];
};

const globalRateLimit = globalThis as unknown as {
  lifeOsRateLimitStore?: Map<string, RateBucket>;
};

function getStore(): Map<string, RateBucket> {
  if (!globalRateLimit.lifeOsRateLimitStore) {
    globalRateLimit.lifeOsRateLimitStore = new Map<string, RateBucket>();
  }
  return globalRateLimit.lifeOsRateLimitStore;
}

export function rateLimit(
  key: string,
  options: { windowMs: number; max: number }
): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const store = getStore();
  const bucket = store.get(key) ?? { hits: [] };
  const windowStart = now - options.windowMs;

  bucket.hits = bucket.hits.filter((hitTs) => hitTs >= windowStart);

  if (bucket.hits.length >= options.max) {
    const oldestHit = bucket.hits[0];
    const retryAfterMs = Math.max(0, oldestHit + options.windowMs - now);
    store.set(key, bucket);
    return { ok: false, retryAfterMs };
  }

  bucket.hits.push(now);
  store.set(key, bucket);

  // Lightweight cleanup for stale keys
  if (store.size > 500) {
    for (const [storeKey, value] of store.entries()) {
      value.hits = value.hits.filter((hitTs) => hitTs >= now - options.windowMs);
      if (value.hits.length === 0) {
        store.delete(storeKey);
      }
    }
  }

  return { ok: true };
}
