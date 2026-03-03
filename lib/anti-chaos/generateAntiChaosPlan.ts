import { Prisma, SystemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AntiChaosDiagnosis =
  | "RecoveryDeficit"
  | "Overcommitment"
  | "FinanceStress"
  | "Stagnation";

export type AntiChaosEffects = {
  Energy: number;
  Focus: number;
  risk: number;
};

export type AntiChaosPlanResult = {
  userId: string;
  date: string;
  diagnoses: AntiChaosDiagnosis[];
  mainPriority: string;
  secondary: [string, string];
  mandatoryRecovery: string;
  cutList: string[];
  expectedEffects: AntiChaosEffects;
  systemStatus: SystemStatus;
};

type ParsedMetrics = {
  sleepHours: number;
  deepWorkMin: number;
  learningMin: number;
  moneyDelta: number;
  workout: number;
};

function toDateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return toDateOnlyUtc(next);
}

function asNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value.toString());
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function parseMetrics(notes: string | null): ParsedMetrics {
  if (!notes) {
    return {
      sleepHours: 0,
      deepWorkMin: 0,
      learningMin: 0,
      moneyDelta: 0,
      workout: 0,
    };
  }

  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      sleepHours: Number(parsed.sleepHours ?? 0),
      deepWorkMin: Number(parsed.deepWorkMin ?? 0),
      learningMin: Number(parsed.learningMin ?? 0),
      moneyDelta: Number(parsed.moneyDelta ?? 0),
      workout: Number(parsed.workout ?? 0),
    };
  } catch {
    return {
      sleepHours: 0,
      deepWorkMin: 0,
      learningMin: 0,
      moneyDelta: 0,
      workout: 0,
    };
  }
}

function detectDiagnoses(input: {
  avgEnergy: number;
  avgStress: number;
  avgSleep: number;
  avgDeepWork: number;
  avgLearning: number;
  workoutRate: number;
  sumMoneyDelta: number;
  avgFinance: number;
  lifeScoreTrend: number;
  growthTrend: number;
}) {
  const diagnoses: AntiChaosDiagnosis[] = [];

  const recoveryDeficit =
    input.avgSleep < 6.5 || input.avgEnergy < 40 || (input.avgStress >= 7.5 && input.workoutRate < 0.4);
  const overcommitment =
    input.avgDeepWork + input.avgLearning > 170 && (input.avgStress >= 7 || input.avgEnergy < 45);
  const financeStress = input.sumMoneyDelta < -2500 || input.avgFinance < 40;
  const stagnation = input.lifeScoreTrend <= 0.5 && input.growthTrend <= 0;

  if (recoveryDeficit) diagnoses.push("RecoveryDeficit");
  if (overcommitment) diagnoses.push("Overcommitment");
  if (financeStress) diagnoses.push("FinanceStress");
  if (stagnation) diagnoses.push("Stagnation");

  return diagnoses.length > 0 ? diagnoses : (["Stagnation"] as AntiChaosDiagnosis[]);
}

function planForDiagnosis(diagnosis: AntiChaosDiagnosis): {
  mainPriority: string;
  secondaryPool: string[];
  mandatoryRecovery: string;
  cutList: string[];
  expectedEffects: AntiChaosEffects;
} {
  if (diagnosis === "RecoveryDeficit") {
    return {
      mainPriority: "Restore baseline recovery for 72 hours",
      secondaryPool: ["Cap deep work to 90 minutes", "Move all non-critical tasks to backlog"],
      mandatoryRecovery: "Sleep window 8h + 20m daylight walk + hydration checkpoint",
      cutList: ["Late-evening deep work", "Optional meetings", "High-caffeine after 14:00"],
      expectedEffects: { Energy: 6, Focus: 2, risk: -0.2 },
    };
  }

  if (diagnosis === "Overcommitment") {
    return {
      mainPriority: "Reduce workload saturation and protect focus bandwidth",
      secondaryPool: ["Enforce single high-value objective", "Batch communications in 2 windows"],
      mandatoryRecovery: "One uninterrupted 30m decompression block before sleep",
      cutList: ["Context-switching tasks", "Parallel projects", "Urgent-but-low-impact work"],
      expectedEffects: { Energy: 4, Focus: 5, risk: -0.18 },
    };
  }

  if (diagnosis === "FinanceStress") {
    return {
      mainPriority: "Stabilize cash volatility and lower financial stressors",
      secondaryPool: ["Freeze discretionary spend for 48h", "Schedule one revenue-positive action today"],
      mandatoryRecovery: "No financial decisions after stress peak periods",
      cutList: ["Impulse purchases", "Low-yield subscriptions", "Unplanned transfers"],
      expectedEffects: { Energy: 2, Focus: 3, risk: -0.15 },
    };
  }

  return {
    mainPriority: "Break stagnation with one measurable growth loop",
    secondaryPool: ["Execute 45m learning sprint", "Close one deferred task before noon"],
    mandatoryRecovery: "10m reflection and next-step commit",
    cutList: ["Passive consumption blocks", "Low-priority admin", "Unstructured scrolling"],
    expectedEffects: { Energy: 2, Focus: 4, risk: -0.1 },
  };
}

function mergeEffects(base: AntiChaosEffects, addition: AntiChaosEffects): AntiChaosEffects {
  return {
    Energy: Math.round((base.Energy + addition.Energy) * 10) / 10,
    Focus: Math.round((base.Focus + addition.Focus) * 10) / 10,
    risk: Math.round((base.risk + addition.risk) * 100) / 100,
  };
}

function encodeActionItems(plan: {
  mainPriority: string;
  secondary: [string, string];
  mandatoryRecovery: string;
  cutList: string[];
  expectedEffects: AntiChaosEffects;
}) {
  return [
    `MAIN|${plan.mainPriority}`,
    `SECONDARY|${plan.secondary[0]}`,
    `SECONDARY|${plan.secondary[1]}`,
    `MANDATORY_RECOVERY|${plan.mandatoryRecovery}`,
    ...plan.cutList.map((item) => `CUT|${item}`),
    `EXPECTED_EFFECTS|${JSON.stringify(plan.expectedEffects)}`,
  ];
}

export function decodeAntiChaosActionItems(actionItems: string[]) {
  const mainPriority = actionItems.find((item) => item.startsWith("MAIN|"))?.slice(5) ?? "";
  const secondary = actionItems
    .filter((item) => item.startsWith("SECONDARY|"))
    .map((item) => item.slice("SECONDARY|".length));
  const mandatoryRecovery =
    actionItems.find((item) => item.startsWith("MANDATORY_RECOVERY|"))?.slice("MANDATORY_RECOVERY|".length) ?? "";
  const cutList = actionItems
    .filter((item) => item.startsWith("CUT|"))
    .map((item) => item.slice("CUT|".length));

  const effectsRaw = actionItems.find((item) => item.startsWith("EXPECTED_EFFECTS|"));
  let expectedEffects: AntiChaosEffects = { Energy: 0, Focus: 0, risk: 0 };
  if (effectsRaw) {
    try {
      expectedEffects = JSON.parse(effectsRaw.slice("EXPECTED_EFFECTS|".length)) as AntiChaosEffects;
    } catch {
      expectedEffects = { Energy: 0, Focus: 0, risk: 0 };
    }
  }

  return {
    mainPriority,
    secondary: [secondary[0] ?? "", secondary[1] ?? ""] as [string, string],
    mandatoryRecovery,
    cutList,
    expectedEffects,
  };
}

export async function generateAntiChaosPlan(date: Date, userId: string): Promise<AntiChaosPlanResult> {
  const day = toDateOnlyUtc(date);
  const fromDate = shiftDays(day, -6);

  const [snapshots, checkins] = await Promise.all([
    prisma.statSnapshot.findMany({
      where: { userId, date: { gte: fromDate, lte: day } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        lifeScore: true,
        health: true,
        finance: true,
        personalGrowth: true,
      },
    }),
    prisma.dailyCheckIn.findMany({
      where: { userId, date: { gte: fromDate, lte: day } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        stressLevel: true,
        notes: true,
      },
    }),
  ]);

  if (snapshots.length === 0 && checkins.length === 0) {
    throw new Error("Not enough data for Anti-Chaos plan. Add recent check-ins first.");
  }

  const parsedCheckins = checkins.map((item) => {
    const metrics = parseMetrics(item.notes);
    return {
      stress: item.stressLevel ?? 5,
      ...metrics,
    };
  });

  const avgEnergy = avg(snapshots.map((s) => asNumber(s.health)));
  const avgFinance = avg(snapshots.map((s) => asNumber(s.finance)));
  const avgStress = avg(parsedCheckins.map((c) => c.stress));
  const avgSleep = avg(parsedCheckins.map((c) => c.sleepHours));
  const avgDeepWork = avg(parsedCheckins.map((c) => c.deepWorkMin));
  const avgLearning = avg(parsedCheckins.map((c) => c.learningMin));
  const workoutRate = avg(parsedCheckins.map((c) => (c.workout > 0 ? 1 : 0)));
  const sumMoneyDelta = parsedCheckins.reduce((sum, c) => sum + c.moneyDelta, 0);

  const firstSnapshot = snapshots[0];
  const lastSnapshot = snapshots[snapshots.length - 1];
  const lifeScoreTrend =
    firstSnapshot && lastSnapshot ? asNumber(lastSnapshot.lifeScore) - asNumber(firstSnapshot.lifeScore) : 0;
  const growthTrend =
    firstSnapshot && lastSnapshot
      ? asNumber(lastSnapshot.personalGrowth) - asNumber(firstSnapshot.personalGrowth)
      : 0;

  const diagnoses = detectDiagnoses({
    avgEnergy,
    avgStress,
    avgSleep,
    avgDeepWork,
    avgLearning,
    workoutRate,
    sumMoneyDelta,
    avgFinance,
    lifeScoreTrend,
    growthTrend,
  });

  const primaryDiagnosis = diagnoses[0];
  const primaryPlan = planForDiagnosis(primaryDiagnosis);
  const secondaryDiagnosis = diagnoses.slice(1, 3);

  const secondaryPool = [...primaryPlan.secondaryPool];
  let expectedEffects = primaryPlan.expectedEffects;
  for (const diagnosis of secondaryDiagnosis) {
    const sub = planForDiagnosis(diagnosis);
    secondaryPool.push(sub.secondaryPool[0]);
    expectedEffects = mergeEffects(expectedEffects, {
      Energy: sub.expectedEffects.Energy * 0.35,
      Focus: sub.expectedEffects.Focus * 0.35,
      risk: sub.expectedEffects.risk * 0.35,
    });
  }

  const secondary: [string, string] = [secondaryPool[0] ?? "", secondaryPool[1] ?? ""];
  const cutList = Array.from(new Set(primaryPlan.cutList)).slice(0, 4);
  const systemStatus =
    diagnoses.includes("RecoveryDeficit") && diagnoses.includes("Overcommitment")
      ? SystemStatus.CRITICAL
      : diagnoses.includes("FinanceStress") || diagnoses.includes("RecoveryDeficit")
        ? SystemStatus.WARNING
        : SystemStatus.STABLE;

  const encodedActions = encodeActionItems({
    mainPriority: primaryPlan.mainPriority,
    secondary,
    mandatoryRecovery: primaryPlan.mandatoryRecovery,
    cutList,
    expectedEffects,
  });

  const saved = await prisma.antiChaosPlan.upsert({
    where: { userId_date: { userId, date: day } },
    update: {
      systemStatus,
      reasons: diagnoses,
      actionItems: encodedActions,
    },
    create: {
      userId,
      date: day,
      systemStatus,
      reasons: diagnoses,
      actionItems: encodedActions,
    },
  });

  const decoded = decodeAntiChaosActionItems(saved.actionItems);

  return {
    userId,
    date: formatDateOnly(saved.date),
    diagnoses: saved.reasons as AntiChaosDiagnosis[],
    mainPriority: decoded.mainPriority,
    secondary: decoded.secondary,
    mandatoryRecovery: decoded.mandatoryRecovery,
    cutList: decoded.cutList,
    expectedEffects: decoded.expectedEffects,
    systemStatus: saved.systemStatus,
  };
}
