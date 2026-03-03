import { formatDateOnly, toUtcDateOnly } from "@/lib/api/date";
import { prisma } from "@/lib/prisma";

export type PatternType =
  | "cyclical_stress_load"
  | "sleep_irregularity"
  | "burnout_acceleration"
  | "autonomic_drift"
  | "circadian_drift";

export type PatternSignal = {
  type: PatternType;
  severity: 0 | 1 | 2 | 3;
  confidence: number;
  windowDays: number;
  detectedAtISO: string;
  headline: string;
  evidence: Array<{ key: string; value: string; unit?: string }>;
  drivers: string[];
  suggestedLever: string;
};

export type PatternSystemMode = "stable" | "cycle" | "drift" | "overload";

export type PatternDetectionResult = {
  systemMode: PatternSystemMode;
  systemModeConfidence: number;
  windowDays: number;
  detectedAtISO: string;
  patterns: PatternSignal[];
  topPatterns: PatternSignal[];
};

type ParsedCheckinMetrics = {
  sleepHours?: number;
  sleepQuality?: number;
  workout?: number;
  deepWorkMin?: number;
};

type SeriesPoint = {
  dateISO: string;
  bedtimeMinutes: number | null;
  wakeTimeMinutes: number | null;
  stress: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  deepWorkMinutes: number | null;
  workout: 0 | 1 | null;
  risk: number | null;
  residualStressLoad: number | null;
  burnout: number | null;
  recoveryDebt: number | null;
  autonomicBalance: number | null;
  circadianPenalty: number | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function slope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((acc, value) => acc + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i - xMean;
    numerator += x * (values[i] - yMean);
    denominator += x * x;
  }
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function autocorrelation(values: number[], lag: number): number {
  if (lag <= 0 || values.length - lag < 4) return 0;
  const a = values.slice(lag);
  const b = values.slice(0, values.length - lag);
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA <= 0 || varB <= 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

function circularStdDevMinutes(values: number[]): number {
  if (values.length < 2) return 0;
  const radians = values.map((minutes) => (minutes / 1440) * 2 * Math.PI);
  const meanSin = radians.reduce((sum, value) => sum + Math.sin(value), 0) / radians.length;
  const meanCos = radians.reduce((sum, value) => sum + Math.cos(value), 0) / radians.length;
  const r = Math.sqrt(meanSin * meanSin + meanCos * meanCos);
  if (r <= 0) return 720;
  return Math.sqrt(-2 * Math.log(r)) * (1440 / (2 * Math.PI));
}

function parseCheckinMetrics(notes: string | null): ParsedCheckinMetrics {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      sleepHours: typeof parsed.sleepHours === "number" ? parsed.sleepHours : undefined,
      sleepQuality: typeof parsed.sleepQuality === "number" ? parsed.sleepQuality : undefined,
      workout: typeof parsed.workout === "number" ? parsed.workout : undefined,
      deepWorkMin: typeof parsed.deepWorkMin === "number" ? parsed.deepWorkMin : undefined,
    };
  } catch {
    return {};
  }
}

function toSeries(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function severityFromThresholds(value: number, levels: [number, number, number]): 0 | 1 | 2 | 3 {
  if (value >= levels[2]) return 3;
  if (value >= levels[1]) return 2;
  if (value >= levels[0]) return 1;
  return 0;
}

function computeRiskFallback(params: {
  stress: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  deepWorkMinutes: number | null;
  workout: 0 | 1 | null;
  reserve: number;
  fatigue: number;
  strain: number;
  overloadLevel: number;
  stressLoad: number;
  circadianAlignment: number;
}): number {
  const stressN = clamp(((params.stress ?? 5) - 1) / 9, 0, 1);
  const deepWork = clamp((params.deepWorkMinutes ?? 0) / 180, 0, 1);
  const workout = clamp(params.workout ?? 0, 0, 1);
  const load = clamp(0.7 * deepWork + 0.6 * workout, 0, 1);
  const sleep = clamp((params.sleepHours ?? 0) / 8, 0, 1);
  const sleepQuality = clamp((params.sleepQuality ?? 0) / 5, 0, 1);
  const recovery = clamp((sleep + sleepQuality + (1 - stressN)) / 3, 0, 1);
  const reserve = clamp(params.reserve / 100, 0, 1);
  const fatigue = clamp(params.fatigue / 100, 0, 1);
  const strain = clamp(params.strain / 100, 0, 1);
  const surplus = clamp(recovery - load, -1, 1);
  const pressure = 0.35 * (1 - reserve) + 0.3 * fatigue + 0.25 * strain + 0.2 * stressN - 0.25 * Math.max(0, surplus);
  let risk = (1 / (1 + Math.exp(-((pressure - 0.35) * 6)))) * 100;
  if (params.overloadLevel === 1) risk += 10;
  if (params.overloadLevel >= 2) risk += 20;
  risk += Math.max(0, (50 - params.circadianAlignment) * 0.3);
  risk += params.stressLoad * 0.1;
  return Math.round(clamp(risk, 0, 100) * 10) / 10;
}

export async function extractSeries(userId: string, endDateISO: string, windowDays = 21): Promise<SeriesPoint[]> {
  const endDate = toUtcDateOnly(endDateISO);
  const span = clamp(Math.round(windowDays), 7, 60);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (span - 1));

  const [checkins, bios] = await Promise.all([
    prisma.dailyCheckIn.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        bedtimeMinutes: true,
        wakeTimeMinutes: true,
        stressLevel: true,
        notes: true,
      },
    }),
    prisma.bioStateSnapshot.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        energyReserve: true,
        cognitiveFatigue: true,
        strainIndex: true,
        overloadLevel: true,
        stressLoad: true,
        circadianAlignment: true,
        burnoutRiskIndex: true,
        recoveryDebt: true,
        autonomicBalance: true,
      },
    }),
  ]);

  const map = new Map<string, SeriesPoint>();
  for (let i = 0; i < span; i += 1) {
    const current = new Date(startDate);
    current.setUTCDate(current.getUTCDate() + i);
    const dateISO = formatDateOnly(current);
    map.set(dateISO, {
      dateISO,
      bedtimeMinutes: null,
      wakeTimeMinutes: null,
      stress: null,
      sleepHours: null,
      sleepQuality: null,
      deepWorkMinutes: null,
      workout: null,
      risk: null,
      residualStressLoad: null,
      burnout: null,
      recoveryDebt: null,
      autonomicBalance: null,
      circadianPenalty: null,
    });
  }

  for (const checkin of checkins) {
    const dateISO = formatDateOnly(checkin.date);
    const item = map.get(dateISO);
    if (!item) continue;
    const parsed = parseCheckinMetrics(checkin.notes);
    item.bedtimeMinutes = checkin.bedtimeMinutes ?? null;
    item.wakeTimeMinutes = checkin.wakeTimeMinutes ?? null;
    item.stress = checkin.stressLevel ?? null;
    item.sleepHours = parsed.sleepHours ?? null;
    item.sleepQuality = parsed.sleepQuality ?? null;
    item.deepWorkMinutes = parsed.deepWorkMin ?? null;
    item.workout = typeof parsed.workout === "number" ? (clamp(parsed.workout, 0, 1) >= 0.5 ? 1 : 0) : null;
  }

  for (const bio of bios) {
    const dateISO = formatDateOnly(bio.date);
    const item = map.get(dateISO);
    if (!item) continue;
    item.residualStressLoad = bio.stressLoad;
    item.burnout = bio.burnoutRiskIndex;
    item.recoveryDebt = bio.recoveryDebt;
    item.autonomicBalance = bio.autonomicBalance;
    item.circadianPenalty = clamp(100 - bio.circadianAlignment, 0, 100);
    item.risk = computeRiskFallback({
      stress: item.stress,
      sleepHours: item.sleepHours,
      sleepQuality: item.sleepQuality,
      deepWorkMinutes: item.deepWorkMinutes,
      workout: item.workout,
      reserve: bio.energyReserve,
      fatigue: bio.cognitiveFatigue,
      strain: bio.strainIndex,
      overloadLevel: bio.overloadLevel,
      stressLoad: bio.stressLoad,
      circadianAlignment: bio.circadianAlignment,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

function detectCyclicalStressLoad(series: SeriesPoint[], windowDays: number, detectedAtISO: string): PatternSignal | null {
  const signal = toSeries(series.map((point) => point.residualStressLoad ?? point.risk));
  if (signal.length < 10) return null;
  let maxCorr = 0;
  let lagMax = 0;
  for (let lag = 3; lag <= 8; lag += 1) {
    const corr = autocorrelation(signal, lag);
    if (corr > maxCorr) {
      maxCorr = corr;
      lagMax = lag;
    }
  }
  const severity = severityFromThresholds(maxCorr, [0.35, 0.45, 0.6]);
  if (severity === 0) return null;
  return {
    type: "cyclical_stress_load",
    severity,
    confidence: Math.round(clamp((maxCorr - 0.35) / 0.35, 0, 1) * 100) / 100,
    windowDays,
    detectedAtISO,
    headline: "Recurring stress-load cycle is present",
    evidence: [
      { key: "periodDays", value: String(lagMax), unit: "days" },
      { key: "maxCorr", value: maxCorr.toFixed(2) },
    ],
    drivers: ["residual_stress_load", "risk_recurrence"],
    suggestedLever: "load_cycle_flattening",
  };
}

function computeSleepIrregularityStats(series: SeriesPoint[]): { stdWake: number; stdBed: number; std: number } {
  const wake = toSeries(series.map((point) => point.wakeTimeMinutes));
  const bed = toSeries(series.map((point) => point.bedtimeMinutes));
  const stdWake = circularStdDevMinutes(wake);
  const stdBed = circularStdDevMinutes(bed);
  return {
    stdWake,
    stdBed,
    std: Math.max(stdWake, stdBed),
  };
}

function detectSleepIrregularity(series: SeriesPoint[], windowDays: number, detectedAtISO: string): PatternSignal | null {
  const { stdWake, stdBed, std } = computeSleepIrregularityStats(series);
  const severity = severityFromThresholds(std, [50, 70, 95]);
  if (severity === 0) return null;
  return {
    type: "sleep_irregularity",
    severity,
    confidence: Math.round(clamp((std - 50) / 80, 0, 1) * 100) / 100,
    windowDays,
    detectedAtISO,
    headline: "Sleep timing regularity is degraded",
    evidence: [
      { key: "stdWakeMin", value: stdWake.toFixed(0), unit: "min" },
      { key: "stdBedMin", value: stdBed.toFixed(0), unit: "min" },
    ],
    drivers: ["wake_variability", "bedtime_variability"],
    suggestedLever: "sleep_anchor",
  };
}

function detectBurnoutAcceleration(series: SeriesPoint[], windowDays: number, detectedAtISO: string): PatternSignal | null {
  const signal = toSeries(series.map((point) => point.burnout));
  if (signal.length < 7) return null;
  const last7 = signal.slice(-7);
  const slope7 = slope(last7);
  const accel = slope(last7.slice(-3)) - slope(last7.slice(0, 4));
  let severity: 0 | 1 | 2 | 3 = 0;
  if (slope7 > 1.8 && accel > 0.3) severity = 3;
  else if (slope7 > 1.0 && accel > 0.2) severity = 2;
  else if (slope7 > 0.5 && accel > 0.1) severity = 1;
  if (severity === 0) return null;
  const confidenceBase = clamp((slope7 - 0.5) / 1.8, 0, 1);
  const confidenceAccel = clamp((accel - 0.1) / 0.3, 0, 1);
  return {
    type: "burnout_acceleration",
    severity,
    confidence: Math.round(confidenceBase * confidenceAccel * 100) / 100,
    windowDays,
    detectedAtISO,
    headline: "Burnout trajectory is accelerating",
    evidence: [
      { key: "slope7", value: slope7.toFixed(2), unit: "pt/day" },
      { key: "accel", value: accel.toFixed(2), unit: "pt/day^2" },
    ],
    drivers: ["burnout_index_slope", "burnout_acceleration"],
    suggestedLever: "workload_cap",
  };
}

function detectAutonomicDrift(series: SeriesPoint[], windowDays: number, detectedAtISO: string): PatternSignal | null {
  const autonomic14 = toSeries(series.map((point) => point.autonomicBalance)).slice(-14);
  const debt14 = toSeries(series.map((point) => point.recoveryDebt)).slice(-14);
  if (autonomic14.length < 7 || debt14.length < 7) return null;
  const aSlope = slope(autonomic14);
  const dSlope = slope(debt14);
  let severity: 0 | 1 | 2 | 3 = 0;
  if (aSlope < -1.2 && dSlope > 1.0) severity = 3;
  else if (aSlope < -0.8 && dSlope > 0.7) severity = 2;
  else if (aSlope < -0.4 && dSlope > 0.4) severity = 1;
  if (severity === 0) return null;
  const confidenceA = clamp((-aSlope - 0.4) / 1.0, 0, 1);
  const confidenceD = clamp((dSlope - 0.4) / 0.8, 0, 1);
  return {
    type: "autonomic_drift",
    severity,
    confidence: Math.round(confidenceA * confidenceD * 100) / 100,
    windowDays,
    detectedAtISO,
    headline: "Autonomic balance is drifting from recovery",
    evidence: [
      { key: "aSlope", value: aSlope.toFixed(2), unit: "pt/day" },
      { key: "dSlope", value: dSlope.toFixed(2), unit: "pt/day" },
    ],
    drivers: ["autonomic_balance_down", "recovery_debt_up"],
    suggestedLever: "recovery_block",
  };
}

function detectCircadianDrift(series: SeriesPoint[], windowDays: number, detectedAtISO: string): PatternSignal | null {
  const circadian14 = toSeries(series.map((point) => point.circadianPenalty)).slice(-14);
  if (circadian14.length < 7) return null;
  const cSlope = slope(circadian14);
  const { stdWake } = computeSleepIrregularityStats(series);
  let severity: 0 | 1 | 2 | 3 = 0;
  if (cSlope > 0.5 && stdWake >= 90) severity = 3;
  else if (cSlope > 0.3 && stdWake >= 70) severity = 2;
  else if (cSlope > 0.15 && stdWake >= 50) severity = 1;
  if (severity === 0) return null;
  const confidenceC = clamp((cSlope - 0.15) / 0.5, 0, 1);
  const confidenceW = clamp((stdWake - 50) / 80, 0, 1);
  return {
    type: "circadian_drift",
    severity,
    confidence: Math.round(confidenceC * confidenceW * 100) / 100,
    windowDays,
    detectedAtISO,
    headline: "Circadian penalty trend is worsening",
    evidence: [
      { key: "cSlope", value: cSlope.toFixed(2), unit: "pt/day" },
      { key: "stdWakeMin", value: stdWake.toFixed(0), unit: "min" },
    ],
    drivers: ["circadian_penalty_up", "wake_anchor_instability"],
    suggestedLever: "sleep_anchor",
  };
}

function modeFromPatterns(patterns: PatternSignal[]): { mode: PatternSystemMode; contributors: PatternSignal[] } {
  const burnout = patterns.find((item) => item.type === "burnout_acceleration");
  const autonomic = patterns.find((item) => item.type === "autonomic_drift");
  const circadian = patterns.find((item) => item.type === "circadian_drift");
  const cyclical = patterns.find((item) => item.type === "cyclical_stress_load");

  if (burnout && burnout.severity >= 2) return { mode: "overload", contributors: [burnout] };
  if ((autonomic && autonomic.severity >= 2) || (circadian && circadian.severity >= 2)) {
    return {
      mode: "drift",
      contributors: [autonomic, circadian].filter((item): item is PatternSignal => Boolean(item && item.severity >= 2)),
    };
  }
  if (cyclical && cyclical.severity >= 2) return { mode: "cycle", contributors: [cyclical] };
  return { mode: "stable", contributors: [] };
}

export async function detectPatterns(params: {
  userId: string;
  endDateISO: string;
  windowDays?: number;
}): Promise<PatternDetectionResult> {
  const windowDays = clamp(Math.round(params.windowDays ?? 21), 7, 60);
  const series = await extractSeries(params.userId, params.endDateISO, windowDays);
  const detected = [
    detectCyclicalStressLoad(series, windowDays, params.endDateISO),
    detectSleepIrregularity(series, windowDays, params.endDateISO),
    detectBurnoutAcceleration(series, windowDays, params.endDateISO),
    detectAutonomicDrift(series, windowDays, params.endDateISO),
    detectCircadianDrift(series, windowDays, params.endDateISO),
  ]
    .filter((item): item is PatternSignal => item !== null)
    .sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.type.localeCompare(b.type);
    });

  const { mode, contributors } = modeFromPatterns(detected);
  const systemModeConfidence =
    contributors.length > 0 ? Math.max(...contributors.map((item) => item.confidence)) : 0;

  return {
    systemMode: mode,
    systemModeConfidence: Math.round(clamp(systemModeConfidence, 0, 1) * 100) / 100,
    windowDays,
    detectedAtISO: params.endDateISO,
    patterns: detected,
    topPatterns: detected.slice(0, 3),
  };
}
