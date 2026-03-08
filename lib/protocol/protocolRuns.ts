import { buildProtocol, type ProtocolMode } from "@/lib/engine/protocolRules";
import { computeIntegrity } from "@/lib/engine/systemIntegrity";
import { evaluateGuardrail } from "@/lib/guardrails/guardrailEngine";
import { prisma } from "@/lib/prisma";
import { getActiveProtocol } from "@/lib/protocol/protocolHelpers";

type HorizonHours = 24 | 48 | 72;

type ProtocolInputs = {
  load: number;
  recovery: number;
  risk: number;
  burnout: number;
  avgRisk14d: number;
  confidence: number;
};

type ProtocolInputsJson = {
  load?: number;
  recovery?: number;
  risk?: number;
};

type CheckinMetrics = {
  workout?: number;
  deepWorkMin?: number;
};


function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toHorizonHours(input: number): HorizonHours {
  if (input === 24 || input === 48 || input === 72) return input;
  throw new Error("horizonHours must be one of: 24, 48, 72.");
}

function toProtocolMode(input: string | null | undefined): ProtocolMode {
  return input === "STABILIZE" ? "STABILIZE" : "STANDARD";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function guardrailSeverity(label: string): number {
  if (label === "LOCKDOWN") return 2;
  if (label === "CAUTION") return 1;
  return 0;
}

function asProtocolInputsJson(value: unknown): ProtocolInputsJson {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  return {
    load: typeof obj.load === "number" ? obj.load : undefined,
    recovery: typeof obj.recovery === "number" ? obj.recovery : undefined,
    risk: typeof obj.risk === "number" ? obj.risk : undefined,
  };
}

function parseCheckinMetrics(notes: string | null): CheckinMetrics {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      workout: typeof parsed.workout === "number" ? parsed.workout : undefined,
      deepWorkMin: typeof parsed.deepWorkMin === "number" ? parsed.deepWorkMin : undefined,
    };
  } catch {
    return {};
  }
}

function parseProtocolConstraints(value: unknown): Array<{ label: string; value: string; severity: "hard" | "soft" }> {
  if (!value || typeof value !== "object") return [];
  const protocol = value as Record<string, unknown>;
  if (!Array.isArray(protocol.constraints)) return [];
  return protocol.constraints
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.label !== "string" || typeof row.value !== "string") return null;
      const severity = row.severity === "hard" ? "hard" : row.severity === "soft" ? "soft" : null;
      if (!severity) return null;
      return { label: row.label, value: row.value, severity };
    })
    .filter((item): item is { label: string; value: string; severity: "hard" | "soft" } => item !== null);
}

function computeConfidenceFromSetup(done: number, needed: number): number {
  const safeNeeded = Math.max(1, needed);
  return clamp(done / safeNeeded, 0, 1);
}

function computeInputsFromBio(args: {
  energyReserve: number;
  cognitiveFatigue: number;
  strainIndex: number;
  stressLoad: number;
  burnoutRiskIndex: number;
  parasympatheticDrive: number;
  resilienceIndex: number;
}): { load: number; recovery: number; risk: number; burnout: number } {
  const load = clamp(
    args.cognitiveFatigue * 0.45 + args.strainIndex * 0.35 + args.stressLoad * 0.2,
    0,
    100
  );
  const recovery = clamp(
    args.energyReserve * 0.45 + args.parasympatheticDrive * 0.25 + args.resilienceIndex * 0.3,
    0,
    100
  );
  const risk = clamp(
    args.burnoutRiskIndex * 0.5 + args.strainIndex * 0.35 + (100 - args.energyReserve) * 0.15,
    0,
    100
  );

  return {
    load: round1(load),
    recovery: round1(recovery),
    risk: round1(risk),
    burnout: round1(clamp(args.burnoutRiskIndex, 0, 100)),
  };
}

async function getCurrentProtocolContext(userId: string): Promise<{
  inputs: { load: number; recovery: number; risk: number; burnout: number };
  integrityInputs: { deepWorkMinutes: number; stress: number; workoutIntensity: number };
  guardrailLabel: "OPEN" | "CAUTION" | "LOCKDOWN";
  avgRisk14d: number;
  confidence: number;
  adaptiveRiskOffset: number;
}> {
  const [user, latestBio, bioRows14d, latestCheckin] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        calibrationCheckinsDone: true,
        calibrationCheckinsNeeded: true,
        adaptiveRiskOffset: true,
      },
    }),
    prisma.bioStateSnapshot.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: {
        energyReserve: true,
        cognitiveFatigue: true,
        strainIndex: true,
        overloadLevel: true,
        recoveryDebt: true,
        adaptiveCapacity: true,
        stressLoad: true,
        burnoutRiskIndex: true,
        parasympatheticDrive: true,
        resilienceIndex: true,
      },
    }),
    prisma.bioStateSnapshot.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 14,
      select: {
        energyReserve: true,
        strainIndex: true,
        burnoutRiskIndex: true,
      },
    }),
    prisma.dailyCheckIn.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: {
        stressLevel: true,
        notes: true,
      },
    }),
  ]);

  if (!user) {
    throw new Error("User not found.");
  }
  if (!latestBio) {
    throw new Error("No bio state available for protocol generation.");
  }

  const confidence = computeConfidenceFromSetup(user.calibrationCheckinsDone, user.calibrationCheckinsNeeded);
  const latestCheckinMetrics = parseCheckinMetrics(latestCheckin?.notes ?? null);
  const integrityInputs = {
    deepWorkMinutes: typeof latestCheckinMetrics.deepWorkMin === "number" ? latestCheckinMetrics.deepWorkMin : 0,
    stress:
      typeof latestCheckin?.stressLevel === "number" && Number.isFinite(latestCheckin.stressLevel)
        ? latestCheckin.stressLevel
        : 5,
    workoutIntensity: typeof latestCheckinMetrics.workout === "number" ? latestCheckinMetrics.workout : 0,
  };
  const latestInputs = computeInputsFromBio({
    energyReserve: latestBio.energyReserve,
    cognitiveFatigue: latestBio.cognitiveFatigue,
    strainIndex: latestBio.strainIndex,
    stressLoad: latestBio.stressLoad,
    burnoutRiskIndex: latestBio.burnoutRiskIndex,
    parasympatheticDrive: latestBio.parasympatheticDrive,
    resilienceIndex: latestBio.resilienceIndex,
  });

  const avgRisk14dRaw =
    bioRows14d.length > 0
      ? bioRows14d.reduce((sum, row) => {
          const rowRisk = clamp(
            row.burnoutRiskIndex * 0.5 + row.strainIndex * 0.35 + (100 - row.energyReserve) * 0.15,
            0,
            100
          );
          return sum + rowRisk;
        }, 0) / bioRows14d.length
      : latestInputs.risk;
  const recentRiskRows = bioRows14d.slice(0, 7);
  const previousRiskRows = bioRows14d.slice(7, 14);
  const recentRiskAvg =
    recentRiskRows.length > 0
      ? recentRiskRows.reduce((sum, row) => {
          const rowRisk = clamp(
            row.burnoutRiskIndex * 0.5 + row.strainIndex * 0.35 + (100 - row.energyReserve) * 0.15,
            0,
            100
          );
          return sum + rowRisk;
        }, 0) / recentRiskRows.length
      : latestInputs.risk;
  const previousRiskAvg =
    previousRiskRows.length > 0
      ? previousRiskRows.reduce((sum, row) => {
          const rowRisk = clamp(
            row.burnoutRiskIndex * 0.5 + row.strainIndex * 0.35 + (100 - row.energyReserve) * 0.15,
            0,
            100
          );
          return sum + rowRisk;
        }, 0) / previousRiskRows.length
      : recentRiskAvg;
  const adaptiveRiskOffset = user.adaptiveRiskOffset ?? 0;
  const avgRisk14d = round1(clamp(avgRisk14dRaw + adaptiveRiskOffset, 0, 100));

  const guardrail = evaluateGuardrail({
    currentRisk: latestInputs.risk,
    avgRisk14d,
    burnout: latestInputs.burnout,
    confidence,
    adaptiveRiskOffset,
    recoveryDebt: latestBio.recoveryDebt,
    adaptiveCapacity: latestBio.adaptiveCapacity,
    resilience: latestBio.resilienceIndex,
    overloadLevel: latestBio.overloadLevel,
    riskDelta7d: round1(recentRiskAvg - previousRiskAvg),
    load: latestInputs.load,
    recovery: latestInputs.recovery,
  });

  return {
    inputs: latestInputs,
    integrityInputs,
    guardrailLabel: guardrail.label,
    avgRisk14d,
    confidence: round1(confidence),
    adaptiveRiskOffset,
  };
}

export async function generateProtocol(userId: string, horizonHoursRaw: number, modeRaw: string = "STANDARD") {
  const horizonHours = toHorizonHours(horizonHoursRaw);
  const requestedMode = toProtocolMode(modeRaw);
  const context = await getCurrentProtocolContext(userId);

  const protocolInputs: ProtocolInputs = {
    load: context.inputs.load,
    recovery: context.inputs.recovery,
    risk: context.inputs.risk,
    burnout: context.inputs.burnout,
    avgRisk14d: context.avgRisk14d,
    confidence: context.confidence,
  };

  const activeRuns = await prisma.protocolRun.findMany({
    where: { userId, appliedAt: { not: null } },
    orderBy: { appliedAt: "desc" },
    take: 10,
    select: {
      id: true,
      appliedAt: true,
      horizonHours: true,
      mode: true,
      guardrailState: true,
    },
  });
  const activeRun = getActiveProtocol(activeRuns);
  const mode =
    activeRun?.mode === "STABILIZE" &&
    guardrailSeverity(context.guardrailLabel) > guardrailSeverity(activeRun.guardrailState)
      ? "STABILIZE"
      : requestedMode;

  const protocolPayload = buildProtocol({
    guardrailState: context.guardrailLabel,
    mode,
    risk: protocolInputs.risk,
    recovery: protocolInputs.recovery,
    load: protocolInputs.load,
    confidence: protocolInputs.confidence,
    horizonHours,
  });

  const previousAppliedExpired = await prisma.protocolRun.findFirst({
    where: {
      userId,
      appliedAt: { not: null },
    },
    orderBy: { appliedAt: "desc" },
    select: {
      id: true,
      appliedAt: true,
      horizonHours: true,
      guardrailState: true,
      inputs: true,
      protocol: true,
      outcome: true,
    },
  });

  if (previousAppliedExpired?.appliedAt && previousAppliedExpired.outcome == null) {
    const expiry = new Date(previousAppliedExpired.appliedAt.getTime() + previousAppliedExpired.horizonHours * 60 * 60 * 1000);
    if (expiry.getTime() <= Date.now()) {
      const previousInputs = asProtocolInputsJson(previousAppliedExpired.inputs);
      const prevRisk = typeof previousInputs.risk === "number" ? previousInputs.risk : context.inputs.risk;
      const prevRecovery = typeof previousInputs.recovery === "number" ? previousInputs.recovery : context.inputs.recovery;
      const prevLoad = typeof previousInputs.load === "number" ? previousInputs.load : context.inputs.load;
      await prisma.protocolRun.update({
        where: { id: previousAppliedExpired.id },
        data: {
          outcome: {
            riskDelta: round1(context.inputs.risk - prevRisk),
            recoveryDelta: round1(context.inputs.recovery - prevRecovery),
            loadDelta: round1(context.inputs.load - prevLoad),
            guardrailAtApply: previousAppliedExpired.guardrailState,
            guardrailNow: context.guardrailLabel,
          },
          integrityAtEnd: (() => {
            const integrity = computeIntegrity({
              activeProtocol: {
                constraints: parseProtocolConstraints(previousAppliedExpired.protocol),
                riskAtApply: prevRisk,
                requiredMinRecovery: prevRecovery,
              },
              currentInputs: context.integrityInputs,
              currentRisk: context.inputs.risk,
              currentRecovery: context.inputs.recovery,
            });
            return {
              finalScore: integrity.score,
              finalState: integrity.state,
            };
          })(),
        },
      });
    }
  }

  const run = await prisma.protocolRun.create({
    data: {
      userId,
      horizonHours,
      mode,
      guardrailState: context.guardrailLabel,
      confidence: context.confidence,
      inputs: {
        ...protocolInputs,
      },
      protocol: protocolPayload,
    },
  });

  return run;
}

export async function getActiveProtocolRun(userId: string) {
  const rows = await prisma.protocolRun.findMany({
    where: {
      userId,
      appliedAt: { not: null },
    },
    orderBy: { appliedAt: "desc" },
    take: 10,
  });

  return getActiveProtocol(rows);
}

export async function applyProtocol(protocolRunId: string, userId: string) {
  const run = await prisma.protocolRun.findFirst({
    where: { id: protocolRunId, userId },
    select: { id: true, appliedAt: true, mode: true },
  });
  if (!run) {
    throw new Error("Protocol run not found.");
  }

  if (run.mode === "STABILIZE") {
    const activeRuns = await prisma.protocolRun.findMany({
      where: { userId, appliedAt: { not: null } },
      orderBy: { appliedAt: "desc" },
      take: 10,
      select: {
        id: true,
        mode: true,
        appliedAt: true,
        horizonHours: true,
        guardrailState: true,
        inputs: true,
        protocol: true,
        outcome: true,
        integrityAtEnd: true,
      },
    });
    const activeRun = getActiveProtocol(activeRuns);
    if (activeRun && activeRun.id !== run.id && activeRun.mode === "STANDARD") {
      const now = Date.now();
      const context = await getCurrentProtocolContext(userId);
      const activeInputs = asProtocolInputsJson(activeRun.inputs);
      const prevRisk = typeof activeInputs.risk === "number" ? activeInputs.risk : context.inputs.risk;
      const prevRecovery = typeof activeInputs.recovery === "number" ? activeInputs.recovery : context.inputs.recovery;
      const prevLoad = typeof activeInputs.load === "number" ? activeInputs.load : context.inputs.load;
      const expiredAppliedAt = new Date(now - activeRun.horizonHours * 60 * 60 * 1000 - 1000);
      const integrity = computeIntegrity({
        activeProtocol: {
          constraints: parseProtocolConstraints(activeRun.protocol),
          riskAtApply: prevRisk,
          requiredMinRecovery: prevRecovery,
        },
        currentInputs: context.integrityInputs,
        currentRisk: context.inputs.risk,
        currentRecovery: context.inputs.recovery,
      });

      await prisma.protocolRun.update({
        where: { id: activeRun.id },
        data: {
          appliedAt: expiredAppliedAt,
          outcome:
            activeRun.outcome ??
            ({
              riskDelta: round1(context.inputs.risk - prevRisk),
              recoveryDelta: round1(context.inputs.recovery - prevRecovery),
              loadDelta: round1(context.inputs.load - prevLoad),
              guardrailAtApply: activeRun.guardrailState,
              guardrailNow: context.guardrailLabel,
            } as object),
          integrityAtEnd:
            activeRun.outcome ??
            ({
              finalScore: integrity.score,
              finalState: integrity.state,
            } as object),
        },
      });
    }
  }

  return prisma.protocolRun.update({
    where: { id: protocolRunId },
    data: { appliedAt: run.appliedAt ?? new Date() },
  });
}

export async function listProtocolRuns(userId: string, limit = 20) {
  const safeLimit = clamp(Math.trunc(limit), 1, 50);
  return prisma.protocolRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });
}
