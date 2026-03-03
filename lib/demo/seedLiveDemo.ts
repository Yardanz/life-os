import { SystemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalculateDay } from "@/lib/services/recalculateDay";
import { LIVE_DEMO_USER_ID } from "@/lib/demoMode";

function toDateOnly(daysAgo: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

function buildNotes(daysAgo: number) {
  const sleepHours = 6.8 + ((daysAgo % 5) - 2) * 0.2;
  const sleepQuality = 3.5 + ((daysAgo + 1) % 4) * 0.2;
  const deepWorkMin = 70 + ((daysAgo * 13) % 60);
  const learningMin = 20 + ((daysAgo * 7) % 35);
  const stress = 4 + (daysAgo % 4);
  const workout = daysAgo % 2 === 0 ? 1 : 0;
  const moneyDelta = (daysAgo % 3 === 0 ? 120 : -40) + daysAgo * 3;
  return {
    sleepHours: Math.max(5.5, Math.min(8.5, Number(sleepHours.toFixed(1)))),
    sleepQuality: Math.max(2.5, Math.min(5, Number(sleepQuality.toFixed(1)))),
    bedtimeMinutes: 23 * 60 + 10 + (daysAgo % 4) * 5,
    wakeTimeMinutes: 7 * 60 + 10 + (daysAgo % 3) * 5,
    workout,
    deepWorkMin,
    learningMin,
    moneyDelta,
    stress,
    noteText: "Live demo seed data",
  };
}

async function resolveActiveConfigVersion(): Promise<number> {
  const active = await prisma.weightConfig.findFirst({
    where: { isActive: true },
    orderBy: [{ effectiveFrom: "desc" }, { configVersion: "desc" }],
    select: { configVersion: true },
  });
  if (!active) {
    throw new Error("WeightConfig not found. Cannot seed live demo user.");
  }
  return active.configVersion;
}

export async function ensureLiveDemoData(): Promise<void> {
  await prisma.user.upsert({
    where: { id: LIVE_DEMO_USER_ID },
    update: {
      plan: "PRO",
      role: "USER",
      onboardingCompleted: true,
      calibrationCheckinsDone: 7,
      calibrationCheckinsNeeded: 7,
    },
    create: {
      id: LIVE_DEMO_USER_ID,
      email: "demo@lifeos.local",
      name: "Live Demo",
      plan: "PRO",
      role: "USER",
      onboardingCompleted: true,
      calibrationCheckinsDone: 7,
      calibrationCheckinsNeeded: 7,
    },
  });

  const [checkinsCount, protocolsCount, scenariosCount] = await Promise.all([
    prisma.dailyCheckIn.count({ where: { userId: LIVE_DEMO_USER_ID } }),
    prisma.protocolRun.count({ where: { userId: LIVE_DEMO_USER_ID } }),
    prisma.scenarioSnapshot.count({ where: { userId: LIVE_DEMO_USER_ID } }),
  ]);

  if (checkinsCount >= 10 && protocolsCount >= 3 && scenariosCount >= 2) return;

  const configVersion = await resolveActiveConfigVersion();

  if (checkinsCount < 10) {
    for (let i = 9; i >= 0; i -= 1) {
      const date = toDateOnly(i);
      const stress = 4 + (i % 4);
      const notes = buildNotes(i);
      await prisma.dailyCheckIn.upsert({
        where: { userId_date: { userId: LIVE_DEMO_USER_ID, date } },
        update: {
          stressLevel: stress,
          mood: 7 - (i % 3),
          energyLevel: 6 - (i % 2),
          bedtimeMinutes: notes.bedtimeMinutes,
          wakeTimeMinutes: notes.wakeTimeMinutes,
          notes: JSON.stringify(notes),
          systemStatus: stress >= 7 ? SystemStatus.WARNING : SystemStatus.STABLE,
          configVersion,
        },
        create: {
          userId: LIVE_DEMO_USER_ID,
          date,
          stressLevel: stress,
          mood: 7 - (i % 3),
          energyLevel: 6 - (i % 2),
          bedtimeMinutes: notes.bedtimeMinutes,
          wakeTimeMinutes: notes.wakeTimeMinutes,
          notes: JSON.stringify(notes),
          systemStatus: stress >= 7 ? SystemStatus.WARNING : SystemStatus.STABLE,
          configVersion,
        },
      });
      await recalculateDay(LIVE_DEMO_USER_ID, date);
    }
  }

  if (protocolsCount < 3) {
    const now = new Date();
    const rows = [
      { mode: "STANDARD", guardrailState: "OPEN", horizonHours: 24, confidence: 0.72 },
      { mode: "STANDARD", guardrailState: "CAUTION", horizonHours: 48, confidence: 0.68 },
      { mode: "STABILIZE", guardrailState: "CAUTION", horizonHours: 24, confidence: 0.64 },
    ];
    for (const [idx, row] of rows.entries()) {
      await prisma.protocolRun.create({
        data: {
          userId: LIVE_DEMO_USER_ID,
          createdAt: new Date(now.getTime() - (idx + 2) * 24 * 60 * 60 * 1000),
          appliedAt: new Date(now.getTime() - (idx + 2) * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
          horizonHours: row.horizonHours,
          mode: row.mode,
          guardrailState: row.guardrailState,
          confidence: row.confidence,
          inputs: { risk: 38 - idx * 5, recovery: 62 + idx * 3, load: 54 - idx * 4 },
          protocol: {
            title: "Live demo protocol",
            state: row.guardrailState,
            constraints: [{ label: "Deep work cap", value: "90m", severity: "hard" }],
            allowed: [{ label: "Admin tasks" }],
            minRecovery: [{ label: "Sleep", value: ">= 8h" }],
            reEvaluation: { afterHours: 12, triggers: ["Risk increase"] },
            rationale: ["Seeded demo protocol run"],
          },
        },
      });
    }
  }

  if (scenariosCount < 2) {
    const now = new Date();
    await prisma.scenarioSnapshot.createMany({
      data: [
        {
          userId: LIVE_DEMO_USER_ID,
          createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          name: "Baseline steady",
          horizonDays: 30,
          tags: "BASELINE",
          baseDateISO: toDateOnly(0).toISOString().slice(0, 10),
          source: "live-demo",
          inputModifiers: { sleepMinutesDelta: 15, deepWorkPctDelta: -0.1, stressDelta: -1 },
          projectionResult: { lifeScore30: 67.2, risk30: 28.4, burnout30: 21.1, volatility: 7.2 },
          patternContext: { systemMode: "Stable", topPattern: "load-balance" },
          calibrationConfidence: 0.74,
        },
        {
          userId: LIVE_DEMO_USER_ID,
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          name: "Stabilize push",
          horizonDays: 30,
          tags: "STABILIZE",
          baseDateISO: toDateOnly(0).toISOString().slice(0, 10),
          source: "live-demo",
          inputModifiers: { sleepMinutesDelta: 45, deepWorkPctDelta: -0.25, stressDelta: -2 },
          projectionResult: { lifeScore30: 71.4, risk30: 18.6, burnout30: 14.8, volatility: 5.9 },
          patternContext: { systemMode: "Recovery", topPattern: "stabilization" },
          calibrationConfidence: 0.74,
        },
      ],
    });
  }
}

