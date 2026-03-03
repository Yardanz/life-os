import { formatDateOnly } from "@/lib/api/date";
import { prisma } from "@/lib/prisma";

export type CalibrationSensitivityKey =
  | "sleepEnergy"
  | "stressFocus"
  | "workoutStrain"
  | "circadianRisk"
  | "debtBurnout";

export type CalibrationSensitivity = {
  key: CalibrationSensitivityKey;
  beta: number;
  baselineBeta: number;
  multiplier: number;
};

export type CalibrationProfile = {
  calibrationActive: boolean;
  confidence: number;
  daysAvailable: number;
  multipliers: {
    reserveSleepGain: number;
    focusFromStress: number;
    workoutStrain: number;
    circadianRisk: number;
    debtBurnout: number;
  };
  sensitivities: CalibrationSensitivity[];
  computedAtISO: string;
  windowDays: number;
};

type DailyPoint = {
  dateISO: string;
  sleepHours: number | null;
  stress: number | null;
  workout: number | null;
  energy: number | null;
  focus: number | null;
  strain: number | null;
  circadianPenalty: number | null;
  recoveryDebt: number | null;
  burnout: number | null;
  risk: number | null;
};

const BASELINE_BETA: Record<CalibrationSensitivityKey, number> = {
  sleepEnergy: 0.8,
  stressFocus: -1.4,
  workoutStrain: 5.5,
  circadianRisk: 0.6,
  debtBurnout: 0.06,
};

const cache = new Map<
  string,
  {
    profile: CalibrationProfile;
    endDateISO: string;
    latestDataISO: string;
    daysAvailable: number;
  }
>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function slopeLeastSquares(x: number[], y: number[]): number {
  if (x.length < 3 || y.length < 3 || x.length !== y.length) return 0;
  const meanX = x.reduce((sum, value) => sum + value, 0) / x.length;
  const meanY = y.reduce((sum, value) => sum + value, 0) / y.length;
  let cov = 0;
  let varX = 0;
  for (let idx = 0; idx < x.length; idx += 1) {
    const dx = x[idx] - meanX;
    cov += dx * (y[idx] - meanY);
    varX += dx * dx;
  }
  if (varX <= 1e-9) return 0;
  return cov / varX;
}

function parseMetrics(notes: string | null): {
  sleepHours?: number;
  workout?: number;
} {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      sleepHours: typeof parsed.sleepHours === "number" ? parsed.sleepHours : undefined,
      workout: typeof parsed.workout === "number" ? parsed.workout : undefined,
    };
  } catch {
    return {};
  }
}

function dayDiff(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00.000Z`).getTime();
  const b = new Date(`${bIso}T00:00:00.000Z`).getTime();
  return Math.round((a - b) / 86400000);
}

function riskFromPoint(point: {
  stress: number | null;
  sleepHours: number | null;
  reserve: number | null;
  fatigue: number | null;
  strain: number | null;
  overloadLevel: number | null;
  circadianPenalty: number | null;
  stressLoad: number | null;
}): number {
  const stressN = clamp(((point.stress ?? 5) - 1) / 9, 0, 1);
  const load = 0.55;
  const sleep = clamp((point.sleepHours ?? 0) / 8, 0, 1);
  const recovery = clamp((sleep + (1 - stressN)) / 2, 0, 1);
  const reserve = clamp((point.reserve ?? 50) / 100, 0, 1);
  const fatigue = clamp((point.fatigue ?? 30) / 100, 0, 1);
  const strain = clamp((point.strain ?? 20) / 100, 0, 1);
  const recoverySurplus = clamp(recovery - load, -1, 1);
  const pressure =
    0.35 * (1 - reserve) +
    0.3 * fatigue +
    0.25 * strain +
    0.2 * stressN -
    0.25 * Math.max(0, recoverySurplus);
  let risk = (1 / (1 + Math.exp(-((pressure - 0.35) * 6)))) * 100;
  if ((point.overloadLevel ?? 0) === 1) risk += 10;
  if ((point.overloadLevel ?? 0) === 2) risk += 20;
  risk += (point.circadianPenalty ?? 0) * 0.6;
  risk += (point.stressLoad ?? 20) * 0.1;
  return clamp(risk, 0, 100);
}

function buildSensitivity(key: CalibrationSensitivityKey, beta: number): CalibrationSensitivity {
  const baselineBeta = BASELINE_BETA[key];
  const ratio = baselineBeta === 0 ? 1 : beta / baselineBeta;
  const multiplier = clamp(ratio, 0.5, 1.5);
  return { key, beta, baselineBeta, multiplier };
}

function levelFromMultiplier(multiplier: number): "Low" | "Moderate" | "High" {
  if (multiplier <= 0.85) return "Low";
  if (multiplier >= 1.15) return "High";
  return "Moderate";
}

export function summarizeSensitivityLevels(profile: CalibrationProfile): Record<CalibrationSensitivityKey, "Low" | "Moderate" | "High"> {
  const byKey = new Map(profile.sensitivities.map((item) => [item.key, item.multiplier]));
  return {
    sleepEnergy: levelFromMultiplier(byKey.get("sleepEnergy") ?? 1),
    stressFocus: levelFromMultiplier(byKey.get("stressFocus") ?? 1),
    workoutStrain: levelFromMultiplier(byKey.get("workoutStrain") ?? 1),
    circadianRisk: levelFromMultiplier(byKey.get("circadianRisk") ?? 1),
    debtBurnout: levelFromMultiplier(byKey.get("debtBurnout") ?? 1),
  };
}

export async function buildCalibrationProfile(params: {
  userId: string;
  endDate: Date;
  windowDays?: number;
}): Promise<CalibrationProfile> {
  const endDateISO = formatDateOnly(params.endDate);
  const windowDays = clamp(params.windowDays ?? 30, 21, 30);
  const startDate = new Date(params.endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (windowDays - 1));

  const [checkins, stats, bios] = await Promise.all([
    prisma.dailyCheckIn.findMany({
      where: { userId: params.userId, date: { gte: startDate, lte: params.endDate } },
      orderBy: { date: "asc" },
      select: { date: true, stressLevel: true, notes: true },
    }),
    prisma.statSnapshot.findMany({
      where: { userId: params.userId, date: { gte: startDate, lte: params.endDate } },
      orderBy: { date: "asc" },
      select: { date: true, health: true, relationships: true },
    }),
    prisma.bioStateSnapshot.findMany({
      where: { userId: params.userId, date: { gte: startDate, lte: params.endDate } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        energyReserve: true,
        cognitiveFatigue: true,
        overloadLevel: true,
        strainIndex: true,
        circadianAlignment: true,
        recoveryDebt: true,
        stressLoad: true,
        burnoutRiskIndex: true,
      },
    }),
  ]);

  const pointMap = new Map<string, DailyPoint>();
  for (const row of checkins) {
    const dateISO = formatDateOnly(row.date);
    const parsed = parseMetrics(row.notes);
    pointMap.set(dateISO, {
      dateISO,
      sleepHours: parsed.sleepHours ?? null,
      stress: row.stressLevel ?? null,
      workout: typeof parsed.workout === "number" ? clamp(parsed.workout, 0, 1) : null,
      energy: null,
      focus: null,
      strain: null,
      circadianPenalty: null,
      recoveryDebt: null,
      burnout: null,
      risk: null,
    });
  }

  for (const row of stats) {
    const dateISO = formatDateOnly(row.date);
    const point = pointMap.get(dateISO) ?? {
      dateISO,
      sleepHours: null,
      stress: null,
      workout: null,
      energy: null,
      focus: null,
      strain: null,
      circadianPenalty: null,
      recoveryDebt: null,
      burnout: null,
      risk: null,
    };
    point.energy = Number(row.health);
    point.focus = Number(row.relationships);
    pointMap.set(dateISO, point);
  }

  for (const row of bios) {
    const dateISO = formatDateOnly(row.date);
    const point = pointMap.get(dateISO) ?? {
      dateISO,
      sleepHours: null,
      stress: null,
      workout: null,
      energy: null,
      focus: null,
      strain: null,
      circadianPenalty: null,
      recoveryDebt: null,
      burnout: null,
      risk: null,
    };
    point.strain = row.strainIndex;
    point.circadianPenalty = clamp(100 - row.circadianAlignment, 0, 100);
    point.recoveryDebt = row.recoveryDebt;
    point.burnout = row.burnoutRiskIndex;
    point.risk = riskFromPoint({
      stress: point.stress,
      sleepHours: point.sleepHours,
      reserve: row.energyReserve,
      fatigue: row.cognitiveFatigue,
      strain: row.strainIndex,
      overloadLevel: row.overloadLevel,
      circadianPenalty: point.circadianPenalty,
      stressLoad: row.stressLoad,
    });
    pointMap.set(dateISO, point);
  }

  const points = Array.from(pointMap.values()).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const daysAvailable = points.length;
  const latestDataISO = points[points.length - 1]?.dateISO ?? endDateISO;

  const cached = cache.get(params.userId);
  if (cached) {
    const recentlyComputed = dayDiff(endDateISO, cached.endDateISO) < 7;
    const enoughNewData = daysAvailable - cached.daysAvailable >= 3;
    const sameLatestData = cached.latestDataISO === latestDataISO;
    if (recentlyComputed && !enoughNewData && sameLatestData) {
      return cached.profile;
    }
  }

  const deltas = {
    sleep: [] as number[],
    energy: [] as number[],
    stress: [] as number[],
    focus: [] as number[],
    workout: [] as number[],
    strain: [] as number[],
    circadianPenalty: [] as number[],
    risk: [] as number[],
    debt: [] as number[],
    burnout: [] as number[],
  };

  for (let idx = 1; idx < points.length; idx += 1) {
    const prev = points[idx - 1];
    const curr = points[idx];
    if (prev.sleepHours != null && curr.sleepHours != null && prev.energy != null && curr.energy != null) {
      deltas.sleep.push(curr.sleepHours - prev.sleepHours);
      deltas.energy.push(curr.energy - prev.energy);
    }
    if (prev.stress != null && curr.stress != null && prev.focus != null && curr.focus != null) {
      deltas.stress.push(curr.stress - prev.stress);
      deltas.focus.push(curr.focus - prev.focus);
    }
    if (curr.workout != null && prev.strain != null && curr.strain != null) {
      deltas.workout.push(curr.workout);
      deltas.strain.push(curr.strain - prev.strain);
    }
    if (curr.circadianPenalty != null && prev.risk != null && curr.risk != null) {
      deltas.circadianPenalty.push(curr.circadianPenalty);
      deltas.risk.push(curr.risk - prev.risk);
    }
    if (curr.recoveryDebt != null && prev.burnout != null && curr.burnout != null) {
      deltas.debt.push(curr.recoveryDebt);
      deltas.burnout.push(curr.burnout - prev.burnout);
    }
  }

  const sensitivities: CalibrationSensitivity[] = [
    buildSensitivity("sleepEnergy", slopeLeastSquares(deltas.sleep, deltas.energy)),
    buildSensitivity("stressFocus", slopeLeastSquares(deltas.stress, deltas.focus)),
    buildSensitivity("workoutStrain", slopeLeastSquares(deltas.workout, deltas.strain)),
    buildSensitivity("circadianRisk", slopeLeastSquares(deltas.circadianPenalty, deltas.risk)),
    buildSensitivity("debtBurnout", slopeLeastSquares(deltas.debt, deltas.burnout)),
  ];

  const varianceSignals = [
    clamp(Math.sqrt(variance(deltas.sleep)) / 1.2, 0, 1),
    clamp(Math.sqrt(variance(deltas.stress)) / 1.5, 0, 1),
    clamp(Math.sqrt(variance(deltas.workout)) / 0.5, 0, 1),
    clamp(Math.sqrt(variance(deltas.circadianPenalty)) / 18, 0, 1),
    clamp(Math.sqrt(variance(deltas.debt)) / 18, 0, 1),
  ];
  const inputVarianceFactor =
    varianceSignals.length > 0
      ? varianceSignals.reduce((sum, value) => sum + value, 0) / varianceSignals.length
      : 0;
  const confidence = clamp(daysAvailable / 30, 0, 1) * clamp(inputVarianceFactor, 0, 1);
  const calibrationActive = confidence >= 0.4 && daysAvailable >= 21;

  const sleepMult = sensitivities.find((item) => item.key === "sleepEnergy")?.multiplier ?? 1;
  const stressMult = sensitivities.find((item) => item.key === "stressFocus")?.multiplier ?? 1;
  const workoutMult = sensitivities.find((item) => item.key === "workoutStrain")?.multiplier ?? 1;
  const circadianMult = sensitivities.find((item) => item.key === "circadianRisk")?.multiplier ?? 1;
  const debtMult = sensitivities.find((item) => item.key === "debtBurnout")?.multiplier ?? 1;

  const profile: CalibrationProfile = {
    calibrationActive,
    confidence: Math.round(confidence * 1000) / 1000,
    daysAvailable,
    multipliers: {
      reserveSleepGain: calibrationActive ? sleepMult : 1,
      focusFromStress: calibrationActive ? stressMult : 1,
      workoutStrain: calibrationActive ? workoutMult : 1,
      circadianRisk: calibrationActive ? circadianMult : 1,
      debtBurnout: calibrationActive ? debtMult : 1,
    },
    sensitivities,
    computedAtISO: endDateISO,
    windowDays,
  };

  cache.set(params.userId, {
    profile,
    endDateISO,
    latestDataISO,
    daysAvailable,
  });

  return profile;
}
