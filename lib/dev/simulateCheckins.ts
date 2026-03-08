import { SystemStatus } from "@prisma/client";
import { createSeededRandom } from "@/lib/projection/prng";
import { toUtcDateOnly } from "@/lib/api/date";

export type SimulationScenario = "random" | "burnout_spiral" | "recovery_rebound";

export const SIMULATION_NOTE_MARKER_RANDOM = "[debug] simulated-30d sequence";
export const SIMULATION_NOTE_MARKER_BURNOUT = "[debug] simulated-burnout-spiral";
export const SIMULATION_NOTE_MARKER_RECOVERY = "[debug] simulated-recovery-rebound";

export type SimulateCheckinsParams = {
  userId: string;
  endDateISO: string;
  days: number;
  seed: string | number;
};

export type SimulatedCheckinRecord = {
  userId: string;
  date: Date;
  stressLevel: number;
  mood: number;
  energyLevel: number;
  systemStatus: SystemStatus;
  notePayload: {
    sleepHours: number;
    sleepQuality: number;
    bedtimeMinutes: number;
    wakeTimeMinutes: number;
    workout: number;
    deepWorkMin: number;
    learningMin: number;
    moneyDelta: number;
    stress: number;
    noteText: string | null;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function resolveStatus(stress: number): SystemStatus {
  if (stress >= 9) return SystemStatus.CRITICAL;
  if (stress >= 7) return SystemStatus.WARNING;
  return SystemStatus.STABLE;
}

export function buildSimulatedCheckins(params: SimulateCheckinsParams): SimulatedCheckinRecord[] {
  const days = clamp(params.days, 1, 90);
  const endDate = toUtcDateOnly(params.endDateISO);
  const rng = createSeededRandom(`${params.userId}:${params.endDateISO}:${String(params.seed)}`);
  const records: SimulatedCheckinRecord[] = [];

  // Simulated latent state uses smooth daily inertia rather than independent random draws.
  let sleepHours = randRange(rng, 6.7, 8.1);
  let stress = randRange(rng, 4.3, 6.1);
  let workload = randRange(rng, 0.35, 0.65);
  let recovery = randRange(rng, 0.42, 0.64);
  let wakeAnchor = randRange(rng, 6.5 * 60, 8.1 * 60);
  const weeklyPhase = randRange(rng, 0, Math.PI * 2);
  let badStreakDays = 0;
  let recoveryStreakDays = 0;

  for (let dayIdx = 0; dayIdx < days; dayIdx += 1) {
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - (days - 1 - dayIdx));
    const weeklyWave = Math.sin((dayIdx / 7) * Math.PI * 2 + weeklyPhase);

    if (badStreakDays <= 0 && recoveryStreakDays <= 0 && rng() < 0.11) {
      if (rng() < 0.45) {
        badStreakDays = randInt(rng, 2, 4);
      } else {
        recoveryStreakDays = randInt(rng, 2, 4);
      }
    }

    const badStreakActive = badStreakDays > 0;
    const recoveryStreakActive = recoveryStreakDays > 0;

    const workloadTarget = clamp(
      workload +
        weeklyWave * 0.04 +
        (badStreakActive ? 0.1 : 0) -
        (recoveryStreakActive ? 0.12 : 0) +
        randRange(rng, -0.06, 0.06),
      0.05,
      0.95
    );
    workload = clamp(workload * 0.74 + workloadTarget * 0.26, 0.05, 0.95);

    const sleepTarget = clamp(
      7.35 +
        weeklyWave * 0.3 -
        workload * 0.7 -
        stress * 0.06 +
        recovery * 0.85 +
        (badStreakActive ? -0.6 : 0.15) +
        (recoveryStreakActive ? 0.45 : 0) +
        randRange(rng, -0.35, 0.35),
      5.5,
      9.3
    );
    sleepHours = clamp(sleepHours * 0.7 + sleepTarget * 0.3, 5.5, 9.3);

    const workoutChance = clamp(
      0.32 + recovery * 0.28 - workload * 0.18 - stress * 0.035 + (recoveryStreakActive ? 0.15 : 0) + (badStreakActive ? -0.12 : 0),
      0.08,
      0.78
    );
    const workout = rng() < workoutChance ? 1 : 0;

    const stressTarget = clamp(
      4.6 +
        workload * 3.1 -
        (sleepHours - 7.1) * 0.9 -
        recovery * 2.2 +
        (badStreakActive ? 0.9 : 0) -
        (recoveryStreakActive ? 0.85 : 0) +
        randRange(rng, -0.55, 0.55),
      1.4,
      9.8
    );
    stress = clamp(stress * 0.68 + stressTarget * 0.32, 1, 10);

    const recoveryTarget = clamp(
      0.45 +
        (sleepHours - 7.0) * 0.09 +
        (workout ? 0.11 : -0.03) -
        workload * 0.14 -
        stress * 0.04 +
        (recoveryStreakActive ? 0.12 : 0) +
        randRange(rng, -0.05, 0.05),
      0.08,
      0.92
    );
    recovery = clamp(recovery * 0.71 + recoveryTarget * 0.29, 0.08, 0.92);

    const stressLevel = clamp(Math.round(stress), 1, 10);
    const deepWorkMin = clamp(Math.round((workload * 230 + randRange(rng, -35, 30)) / 5) * 5, 0, 300);
    const learningMin = clamp(Math.round((deepWorkMin * randRange(rng, 0.12, 0.42) + randRange(rng, -8, 24)) / 5) * 5, 0, 120);
    const sleepQuality = clamp(
      Math.round(
        3.1 +
          (sleepHours - 7.0) * 1.05 -
          (stress - 5.2) * 0.42 +
          recovery * 1.1 +
          randRange(rng, -0.55, 0.55)
      ),
      1,
      5
    );

    wakeAnchor = clamp(
      wakeAnchor * 0.85 +
        (7.3 * 60 +
          weeklyWave * 22 +
          (badStreakActive ? 26 : 0) -
          (recoveryStreakActive ? 12 : 0) +
          randRange(rng, -15, 15)) *
          0.15,
      5 * 60,
      10.5 * 60
    );
    const wakeTimeMinutes = clamp(Math.round((wakeAnchor + randRange(rng, -18, 18)) / 5) * 5, 0, 1439);
    const bedtimeMinutes = ((wakeTimeMinutes - Math.round(sleepHours * 60)) % 1440 + 1440) % 1440;

    const moneyDelta = Math.round(
      (workload - 0.5) * 260 +
        (recoveryStreakActive ? 80 : 0) -
        (badStreakActive ? 110 : 0) +
        randRange(rng, -220, 240)
    );
    const mood = clamp(
      Math.round(
        5.2 +
          (sleepHours - 7.0) * 0.9 +
          recovery * 2.1 -
          stress * 0.5 -
          workload * 0.8 +
          (workout ? 0.35 : 0) +
          randRange(rng, -0.65, 0.65)
      ),
      1,
      10
    );
    const energyLevel = clamp(
      Math.round(
        5.0 +
          (sleepHours - 6.8) * 1.15 +
          recovery * 2.0 -
          stress * 0.44 -
          workload * 0.62 +
          (workout ? 0.25 : -0.1) +
          randRange(rng, -0.55, 0.55)
      ),
      1,
      10
    );

    records.push({
      userId: params.userId,
      date,
      stressLevel,
      mood,
      energyLevel,
      systemStatus: resolveStatus(stressLevel),
      notePayload: {
        sleepHours: Math.round(sleepHours * 10) / 10,
        sleepQuality,
        bedtimeMinutes,
        wakeTimeMinutes,
        workout,
        deepWorkMin,
        learningMin,
        moneyDelta,
        stress: stressLevel,
        noteText: SIMULATION_NOTE_MARKER_RANDOM,
      },
    });

    if (badStreakDays > 0) badStreakDays -= 1;
    if (recoveryStreakDays > 0) recoveryStreakDays -= 1;
  }

  return records;
}

type BurnoutPhase = "early_pressure" | "overload_ramp" | "burnout_zone" | "partial_stabilization";

function resolveBurnoutPhase(dayIdx: number): { phase: BurnoutPhase; progress: number } {
  if (dayIdx <= 4) {
    return {
      phase: "early_pressure",
      progress: dayIdx / 4,
    };
  }
  if (dayIdx <= 13) {
    return {
      phase: "overload_ramp",
      progress: (dayIdx - 5) / 8,
    };
  }
  if (dayIdx <= 21) {
    return {
      phase: "burnout_zone",
      progress: (dayIdx - 14) / 7,
    };
  }
  return {
    phase: "partial_stabilization",
    progress: (dayIdx - 22) / 7,
  };
}

function resolveBurnoutTargets(phase: BurnoutPhase, progress: number): {
  sleepHours: number;
  stress: number;
  workload: number;
  recovery: number;
  wakeDriftMinutes: number;
  workoutChance: number;
} {
  if (phase === "early_pressure") {
    return {
      sleepHours: lerp(7.3, 6.8, progress),
      stress: lerp(5.1, 6.4, progress),
      workload: lerp(0.56, 0.69, progress),
      recovery: lerp(0.58, 0.49, progress),
      wakeDriftMinutes: lerp(8, 18, progress),
      workoutChance: lerp(0.38, 0.28, progress),
    };
  }
  if (phase === "overload_ramp") {
    return {
      sleepHours: lerp(6.8, 6.05, progress),
      stress: lerp(6.5, 8.0, progress),
      workload: lerp(0.71, 0.88, progress),
      recovery: lerp(0.47, 0.26, progress),
      wakeDriftMinutes: lerp(20, 54, progress),
      workoutChance: lerp(0.24, 0.12, progress),
    };
  }
  if (phase === "burnout_zone") {
    return {
      sleepHours: lerp(5.95, 5.35, progress),
      stress: lerp(8.2, 9.35, progress),
      workload: lerp(0.86, 0.94, progress),
      recovery: lerp(0.22, 0.11, progress),
      wakeDriftMinutes: lerp(58, 76, progress),
      workoutChance: lerp(0.08, 0.03, progress),
    };
  }
  return {
    sleepHours: lerp(5.6, 6.45, progress),
    stress: lerp(8.3, 7.2, progress),
    workload: lerp(0.83, 0.68, progress),
    recovery: lerp(0.2, 0.43, progress),
    wakeDriftMinutes: lerp(64, 34, progress),
    workoutChance: lerp(0.08, 0.22, progress),
  };
}

export function buildBurnoutSpiralCheckins(params: SimulateCheckinsParams): SimulatedCheckinRecord[] {
  const days = clamp(params.days, 1, 90);
  const endDate = toUtcDateOnly(params.endDateISO);
  const rng = createSeededRandom(`${params.userId}:${params.endDateISO}:burnout:${String(params.seed)}`);
  const records: SimulatedCheckinRecord[] = [];

  let sleepHours = 7.2;
  let stress = 5.1;
  let workload = 0.56;
  let recovery = 0.58;
  let wakeDriftMinutes = 10;

  for (let dayIdx = 0; dayIdx < days; dayIdx += 1) {
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - (days - 1 - dayIdx));

    const { phase, progress } = resolveBurnoutPhase(dayIdx);
    const targets = resolveBurnoutTargets(phase, progress);

    sleepHours = clamp(
      sleepHours * 0.55 + targets.sleepHours * 0.45 + randRange(rng, -0.14, 0.14),
      4.8,
      8.2
    );
    stress = clamp(stress * 0.58 + targets.stress * 0.42 + randRange(rng, -0.2, 0.2), 1, 10);
    workload = clamp(workload * 0.62 + targets.workload * 0.38 + randRange(rng, -0.04, 0.04), 0.12, 0.98);
    recovery = clamp(
      recovery * 0.6 + targets.recovery * 0.4 + (sleepHours - 6.3) * 0.012 - (stress - 6) * 0.006 + randRange(rng, -0.025, 0.025),
      0.04,
      0.88
    );
    wakeDriftMinutes = clamp(
      wakeDriftMinutes * 0.67 + targets.wakeDriftMinutes * 0.33 + randRange(rng, -4, 4),
      -10,
      140
    );

    const workoutChance = clamp(
      targets.workoutChance +
        recovery * 0.12 -
        workload * 0.1 -
        (stress - 6) * 0.03 +
        randRange(rng, -0.03, 0.03),
      0.02,
      0.55
    );
    const workout = rng() < workoutChance ? 1 : 0;

    const stressLevel = clamp(Math.round(stress), 1, 10);
    const deepWorkMinBase = phase === "burnout_zone" ? workload * 280 + 12 : workload * 255;
    const deepWorkMin = clamp(Math.round((deepWorkMinBase + randRange(rng, -22, 20)) / 5) * 5, 20, 320);
    const learningMin = clamp(
      Math.round(
        (phase === "burnout_zone" ? deepWorkMin * 0.12 : deepWorkMin * 0.2) + randRange(rng, -10, 16)
      ),
      0,
      90
    );

    const sleepQuality = clamp(
      Math.round(
        2.9 +
          (sleepHours - 6.7) * 0.95 -
          (stress - 6.2) * 0.36 +
          recovery * 0.9 -
          wakeDriftMinutes * 0.007 +
          randRange(rng, -0.38, 0.38)
      ),
      1,
      5
    );

    const wakeTimeMinutes = clamp(
      Math.round((7 * 60 + 10 + wakeDriftMinutes + randRange(rng, -12, 12)) / 5) * 5,
      0,
      1439
    );
    const bedtimeMinutes = ((wakeTimeMinutes - Math.round(sleepHours * 60)) % 1440 + 1440) % 1440;

    const moneyDelta = Math.round(
      (phase === "burnout_zone" ? -260 : phase === "overload_ramp" ? -140 : phase === "partial_stabilization" ? -60 : 0) +
        randRange(rng, -160, 160)
    );
    const mood = clamp(
      Math.round(
        4.9 +
          (sleepHours - 6.7) * 0.85 +
          recovery * 1.8 -
          stress * 0.55 -
          workload * 0.75 +
          (workout ? 0.22 : -0.05) +
          randRange(rng, -0.5, 0.5)
      ),
      1,
      10
    );
    const energyLevel = clamp(
      Math.round(
        4.8 +
          (sleepHours - 6.6) * 0.95 +
          recovery * 1.75 -
          stress * 0.5 -
          workload * 0.66 +
          (workout ? 0.18 : -0.08) +
          randRange(rng, -0.45, 0.45)
      ),
      1,
      10
    );

    records.push({
      userId: params.userId,
      date,
      stressLevel,
      mood,
      energyLevel,
      systemStatus: resolveStatus(stressLevel),
      notePayload: {
        sleepHours: Math.round(sleepHours * 10) / 10,
        sleepQuality,
        bedtimeMinutes,
        wakeTimeMinutes,
        workout,
        deepWorkMin,
        learningMin,
        moneyDelta,
        stress: stressLevel,
        noteText: SIMULATION_NOTE_MARKER_BURNOUT,
      },
    });
  }

  return records;
}

type RecoveryReboundPhase = "overload_entry" | "stabilization_intervention" | "recovery_rebound";

function resolveRecoveryReboundPhase(dayIdx: number): { phase: RecoveryReboundPhase; progress: number } {
  if (dayIdx <= 9) {
    return {
      phase: "overload_entry",
      progress: dayIdx / 9,
    };
  }
  if (dayIdx <= 17) {
    return {
      phase: "stabilization_intervention",
      progress: (dayIdx - 10) / 7,
    };
  }
  return {
    phase: "recovery_rebound",
    progress: (dayIdx - 18) / 11,
  };
}

function resolveRecoveryReboundTargets(phase: RecoveryReboundPhase, progress: number): {
  sleepHours: number;
  stress: number;
  workload: number;
  recovery: number;
  wakeDriftMinutes: number;
  workoutChance: number;
  deepWorkBase: number;
} {
  if (phase === "overload_entry") {
    return {
      sleepHours: lerp(6.6, 5.55, progress),
      stress: lerp(6.3, 9.0, progress),
      workload: lerp(0.74, 0.93, progress),
      recovery: lerp(0.36, 0.11, progress),
      wakeDriftMinutes: lerp(30, 76, progress),
      workoutChance: lerp(0.18, 0.04, progress),
      deepWorkBase: lerp(205, 295, progress),
    };
  }
  if (phase === "stabilization_intervention") {
    return {
      sleepHours: lerp(5.8, 6.95, progress),
      stress: lerp(8.5, 6.2, progress),
      workload: lerp(0.84, 0.62, progress),
      recovery: lerp(0.16, 0.5, progress),
      wakeDriftMinutes: lerp(68, 22, progress),
      workoutChance: lerp(0.06, 0.24, progress),
      deepWorkBase: lerp(250, 165, progress),
    };
  }
  return {
    sleepHours: lerp(7.0, 7.85, progress),
    stress: lerp(5.9, 4.3, progress),
    workload: lerp(0.58, 0.44, progress),
    recovery: lerp(0.54, 0.76, progress),
    wakeDriftMinutes: lerp(18, 7, progress),
    workoutChance: lerp(0.26, 0.42, progress),
    deepWorkBase: lerp(145, 110, progress),
  };
}

export function buildRecoveryReboundCheckins(params: SimulateCheckinsParams): SimulatedCheckinRecord[] {
  const days = clamp(params.days, 1, 90);
  const endDate = toUtcDateOnly(params.endDateISO);
  const rng = createSeededRandom(`${params.userId}:${params.endDateISO}:recovery:${String(params.seed)}`);
  const records: SimulatedCheckinRecord[] = [];

  let sleepHours = 6.6;
  let stress = 6.2;
  let workload = 0.74;
  let recovery = 0.34;
  let wakeDriftMinutes = 32;

  for (let dayIdx = 0; dayIdx < days; dayIdx += 1) {
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - (days - 1 - dayIdx));

    const { phase, progress } = resolveRecoveryReboundPhase(dayIdx);
    const targets = resolveRecoveryReboundTargets(phase, progress);

    sleepHours = clamp(
      sleepHours * 0.56 + targets.sleepHours * 0.44 + randRange(rng, -0.12, 0.12),
      4.9,
      8.4
    );
    stress = clamp(stress * 0.6 + targets.stress * 0.4 + randRange(rng, -0.2, 0.2), 1, 10);
    workload = clamp(workload * 0.62 + targets.workload * 0.38 + randRange(rng, -0.035, 0.035), 0.1, 0.98);
    recovery = clamp(
      recovery * 0.62 +
        targets.recovery * 0.38 +
        (sleepHours - 6.3) * 0.014 -
        (stress - 6) * 0.007 -
        Math.max(0, workload - 0.7) * 0.02 +
        randRange(rng, -0.02, 0.02),
      0.04,
      0.9
    );
    wakeDriftMinutes = clamp(
      wakeDriftMinutes * 0.68 + targets.wakeDriftMinutes * 0.32 + randRange(rng, -4, 4),
      -10,
      120
    );

    const workoutChance = clamp(
      targets.workoutChance +
        recovery * 0.12 -
        workload * 0.1 -
        (stress - 6) * 0.025 +
        randRange(rng, -0.03, 0.03),
      0.02,
      0.65
    );
    const workout = rng() < workoutChance ? 1 : 0;

    const stressLevel = clamp(Math.round(stress), 1, 10);
    const deepWorkMin = clamp(
      Math.round((targets.deepWorkBase + workload * 35 + randRange(rng, -18, 16)) / 5) * 5,
      25,
      320
    );
    const learningRatio = phase === "overload_entry" ? 0.12 : phase === "stabilization_intervention" ? 0.2 : 0.24;
    const learningMin = clamp(Math.round(deepWorkMin * learningRatio + randRange(rng, -8, 14)), 0, 120);

    const sleepQuality = clamp(
      Math.round(
        2.8 +
          (sleepHours - 6.6) * 1.05 -
          (stress - 6) * 0.34 +
          recovery * 1.15 -
          wakeDriftMinutes * 0.007 +
          randRange(rng, -0.35, 0.35)
      ),
      1,
      5
    );

    const wakeTimeMinutes = clamp(
      Math.round((7 * 60 + 6 + wakeDriftMinutes + randRange(rng, -10, 10)) / 5) * 5,
      0,
      1439
    );
    const bedtimeMinutes = ((wakeTimeMinutes - Math.round(sleepHours * 60)) % 1440 + 1440) % 1440;

    const moneyDelta = Math.round(
      (phase === "overload_entry"
        ? lerp(-120, -260, progress)
        : phase === "stabilization_intervention"
          ? lerp(-120, 15, progress)
          : lerp(20, 120, progress)) + randRange(rng, -130, 130)
    );
    const mood = clamp(
      Math.round(
        4.7 +
          (sleepHours - 6.6) * 0.85 +
          recovery * 2.0 -
          stress * 0.5 -
          workload * 0.72 +
          (workout ? 0.25 : -0.06) +
          randRange(rng, -0.45, 0.45)
      ),
      1,
      10
    );
    const energyLevel = clamp(
      Math.round(
        4.8 +
          (sleepHours - 6.5) * 1 +
          recovery * 1.95 -
          stress * 0.46 -
          workload * 0.64 +
          (workout ? 0.2 : -0.08) +
          randRange(rng, -0.42, 0.42)
      ),
      1,
      10
    );

    records.push({
      userId: params.userId,
      date,
      stressLevel,
      mood,
      energyLevel,
      systemStatus: resolveStatus(stressLevel),
      notePayload: {
        sleepHours: Math.round(sleepHours * 10) / 10,
        sleepQuality,
        bedtimeMinutes,
        wakeTimeMinutes,
        workout,
        deepWorkMin,
        learningMin,
        moneyDelta,
        stress: stressLevel,
        noteText: SIMULATION_NOTE_MARKER_RECOVERY,
      },
    });
  }

  return records;
}
