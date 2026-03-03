import { randomBytes } from "node:crypto";
import { evaluateGuardrail } from "@/lib/guardrails/guardrailEngine";
import { prisma } from "@/lib/prisma";
import { getActiveProtocolRun } from "@/lib/protocol/protocolRuns";
import { allowedSnapshotPayload } from "@/lib/snapshotPolicy";

const SNAPSHOT_TTL_DAYS = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

function parseConstraintsCount(protocol: unknown): number {
  if (!protocol || typeof protocol !== "object") return 0;
  const maybe = protocol as { constraints?: unknown };
  return Array.isArray(maybe.constraints) ? maybe.constraints.length : 0;
}

function computeMetricsFromBio(input: {
  energyReserve: number;
  cognitiveFatigue: number;
  strainIndex: number;
  stressLoad: number;
  burnoutRiskIndex: number;
  parasympatheticDrive: number;
  resilienceIndex: number;
}) {
  const load = clamp(input.cognitiveFatigue * 0.45 + input.strainIndex * 0.35 + input.stressLoad * 0.2, 0, 100);
  const recovery = clamp(
    input.energyReserve * 0.45 + input.parasympatheticDrive * 0.25 + input.resilienceIndex * 0.3,
    0,
    100
  );
  const risk = clamp(input.burnoutRiskIndex * 0.5 + input.strainIndex * 0.35 + (100 - input.energyReserve) * 0.15, 0, 100);
  return {
    load: round1(load),
    recovery: round1(recovery),
    risk: round1(risk),
    burnout: round1(clamp(input.burnoutRiskIndex, 0, 100)),
  };
}

function computeConfidence(done: number, needed: number): number {
  const safeNeeded = Math.max(1, needed);
  return clamp(done / safeNeeded, 0, 1);
}

async function buildSnapshotPayload(userId: string) {
  const [user, latestStat, latestBio, activeProtocol] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        calibrationCheckinsDone: true,
        calibrationCheckinsNeeded: true,
        adaptiveRiskOffset: true,
      },
    }),
    prisma.statSnapshot.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: { lifeScore: true },
    }),
    prisma.bioStateSnapshot.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: {
        energyReserve: true,
        cognitiveFatigue: true,
        strainIndex: true,
        stressLoad: true,
        burnoutRiskIndex: true,
        parasympatheticDrive: true,
        resilienceIndex: true,
      },
    }),
    getActiveProtocolRun(userId),
  ]);

  if (!user || !latestStat || !latestBio) {
    throw new Error("Snapshot source state unavailable.");
  }

  const confidence = computeConfidence(user.calibrationCheckinsDone, user.calibrationCheckinsNeeded);
  const metrics = computeMetricsFromBio(latestBio);
  const guardrail = evaluateGuardrail({
    currentRisk: metrics.risk,
    avgRisk14d: metrics.risk,
    burnout: metrics.burnout,
    confidence,
    adaptiveRiskOffset: user.adaptiveRiskOffset ?? 0,
  });

  return allowedSnapshotPayload({
    capturedAt: new Date().toISOString(),
    lifeScore: round1(Number(latestStat.lifeScore)),
    guardrailState: guardrail.label,
    load: metrics.load,
    recovery: metrics.recovery,
    risk: metrics.risk,
    confidence: round1(confidence),
    integrity: null,
    protocolSummary: activeProtocol
      ? {
          state: activeProtocol.guardrailState,
          horizonHours: activeProtocol.horizonHours,
          mode: activeProtocol.mode,
          constraintsCount: parseConstraintsCount(activeProtocol.protocol),
        }
      : null,
  });
}

export async function generateSystemSnapshot(userId: string) {
  const payload = await buildSnapshotPayload(userId);
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + SNAPSHOT_TTL_DAYS);

  const snapshot = await prisma.systemSnapshot.create({
    data: {
      userId,
      token,
      payload,
      expiresAt,
    },
    select: {
      id: true,
      token: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  const staleRows = await prisma.systemSnapshot.findMany({
    where: {
      userId,
      OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }],
    },
    orderBy: { createdAt: "desc" },
    skip: 50,
    select: { id: true },
  });

  if (staleRows.length > 0) {
    await prisma.systemSnapshot.deleteMany({
      where: {
        userId,
        id: { in: staleRows.map((row) => row.id) },
      },
    });
  }

  return {
    ...snapshot,
    url: `/s/${snapshot.token}`,
  };
}

export async function listSystemSnapshots(userId: string, limit = 5) {
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
  return prisma.systemSnapshot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
    select: {
      id: true,
      token: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
}

export async function revokeSystemSnapshot(userId: string, snapshotId: string) {
  return prisma.systemSnapshot.updateMany({
    where: { id: snapshotId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
