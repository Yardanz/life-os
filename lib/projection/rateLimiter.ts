export type SimulationStep = "DAILY" | "HOURLY";

type RateLimitCaps = {
  maxRise: number;
  maxDrop: number;
};

type MetricCaps = {
  risk: RateLimitCaps;
  burnout: RateLimitCaps;
  strain: RateLimitCaps;
};

const DAILY_CAPS: MetricCaps = {
  risk: { maxRise: 18, maxDrop: 22 },
  burnout: { maxRise: 10, maxDrop: 12 },
  strain: { maxRise: 20, maxDrop: 25 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getRateLimiterCaps(step: SimulationStep): MetricCaps {
  if (step === "DAILY") return DAILY_CAPS;
  return {
    risk: { maxRise: DAILY_CAPS.risk.maxRise / 24, maxDrop: DAILY_CAPS.risk.maxDrop / 24 },
    burnout: { maxRise: DAILY_CAPS.burnout.maxRise / 24, maxDrop: DAILY_CAPS.burnout.maxDrop / 24 },
    strain: { maxRise: DAILY_CAPS.strain.maxRise / 24, maxDrop: DAILY_CAPS.strain.maxDrop / 24 },
  };
}

export function applyRateLimiter(current: number, next: number, caps: RateLimitCaps): number {
  const rawDelta = next - current;
  const limitedDelta = clamp(rawDelta, -caps.maxDrop, caps.maxRise);
  let limited = current + limitedDelta;

  limited = clamp(limited, 0, 100);
  if (limited > 90 && limitedDelta > 0) {
    limited = 90 + (limited - 90) * 0.4;
  }
  if (limited < 10 && limitedDelta < 0) {
    limited = 10 - (10 - limited) * 0.4;
  }

  return clamp(limited, 0, 100);
}
