import { computeNextCheckinCountdown, DEFAULT_TZ_OFFSET_MINUTES } from "@/lib/date/dayKey";

export type SystemEvolutionStage = {
  currentDay: 1 | 3 | 5 | 7;
  completedCheckins: number;
  nextUnlockDay: 3 | 5 | 7 | null;
  unlocked: {
    trajectory: boolean;
    advancedControls: boolean;
    fullDiagnostics: boolean;
  };
};

export function getSystemEvolutionStage(checkinCount: number): SystemEvolutionStage {
  const completedCheckins = Number.isFinite(checkinCount) ? Math.max(0, Math.floor(checkinCount)) : 0;
  const trajectory = completedCheckins >= 3;
  const advancedControls = completedCheckins >= 5;
  const fullDiagnostics = completedCheckins >= 7;

  let currentDay: 1 | 3 | 5 | 7 = 1;
  let nextUnlockDay: 3 | 5 | 7 | null = 3;
  if (fullDiagnostics) {
    currentDay = 7;
    nextUnlockDay = null;
  } else if (advancedControls) {
    currentDay = 5;
    nextUnlockDay = 7;
  } else if (trajectory) {
    currentDay = 3;
    nextUnlockDay = 5;
  }

  return {
    currentDay,
    completedCheckins,
    nextUnlockDay,
    unlocked: {
      trajectory,
      advancedControls,
      fullDiagnostics,
    },
  };
}

export type NextCheckinAvailability = {
  availableNow: boolean;
  nextAvailableAt: Date | null;
  msRemaining: number | null;
};

export function getNextCheckinAvailability(lastCheckinAt: Date | null, now: Date): NextCheckinAvailability {
  if (!lastCheckinAt) {
    return { availableNow: true, nextAvailableAt: null, msRemaining: null };
  }

  const lastCheckinDate = lastCheckinAt;
  if (!Number.isFinite(lastCheckinDate.getTime())) {
    return { availableNow: true, nextAvailableAt: null, msRemaining: null };
  }

  const nextAvailableAt = new Date(lastCheckinDate.getTime() + 24 * 60 * 60 * 1000);
  const diffMs = nextAvailableAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { availableNow: true, nextAvailableAt: null, msRemaining: null };
  }
  return {
    availableNow: false,
    nextAvailableAt,
    msRemaining: diffMs,
  };
}

export function getNextCheckinAvailabilityFromDailyRule(
  todayCheckInExists: boolean,
  now: Date,
  tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES
): NextCheckinAvailability {
  if (!todayCheckInExists) {
    return { availableNow: true, nextAvailableAt: null, msRemaining: null };
  }

  const countdown = computeNextCheckinCountdown(now, tzOffsetMinutes);
  const msRemaining = (countdown.hours * 60 + countdown.minutes) * 60_000;
  return {
    availableNow: false,
    nextAvailableAt: new Date(now.getTime() + msRemaining),
    msRemaining,
  };
}
