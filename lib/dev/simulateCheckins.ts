import { SystemStatus } from "@prisma/client";
import { createSeededRandom } from "@/lib/projection/prng";
import { toUtcDateOnly } from "@/lib/api/date";

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

function pickOne<T>(rng: () => number, values: T[]): T {
  return values[randInt(rng, 0, values.length - 1)];
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
  const deepWorkOptions = [0, 30, 60, 90, 120] as const;
  const learningOptions = [0, 15, 30, 45, 60] as const;

  for (let dayIdx = 0; dayIdx < days; dayIdx += 1) {
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - (days - 1 - dayIdx));
    const sleepHours = Math.round(randRange(rng, 6.0, 9.0) * 10) / 10;
    const deepWorkMin = pickOne(rng, [...deepWorkOptions]);
    const learningMin = pickOne(rng, [...learningOptions]);
    const workout = rng() < 0.3 ? 1 : 0;
    const stressRaw = 3 + randInt(rng, 0, 5) + (deepWorkMin >= 90 ? 1 : 0) - (sleepHours >= 8 ? 1 : 0);
    const stressLevel = clamp(stressRaw, 3, 8);
    const sleepQuality = clamp(3 + (sleepHours >= 7.5 ? 1 : 0) - (stressLevel >= 7 ? 1 : 0) + randInt(rng, 0, 1), 3, 5);
    const moneyDelta = randInt(rng, -200, 300);
    const wakeTimeMinutes = clamp(randInt(rng, 360, 510), 0, 1439);
    const bedtimeMinutes = ((wakeTimeMinutes - Math.round(sleepHours * 60)) % 1440 + 1440) % 1440;
    const mood = clamp(Math.round(5 + (sleepHours - 6) * 0.8 - (stressLevel - 3) * 0.5 + (workout ? 0.3 : 0)), 1, 10);
    const energyLevel = clamp(Math.round(5 + (sleepHours - 6) * 1.0 - (stressLevel - 3) * 0.4 + (workout ? 0.2 : 0)), 1, 10);

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
        noteText: null,
      },
    });
  }

  return records;
}
