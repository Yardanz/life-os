import { SystemStatus } from "@prisma/client";
import { toUtcDateOnly } from "@/lib/api/date";
import type { AntiChaosProtocol } from "@/lib/anti-chaos/antiChaos.types";
import { prisma } from "@/lib/prisma";

function resolveSystemStatus(risk: number): SystemStatus {
  if (risk >= 85) return SystemStatus.CRITICAL;
  if (risk >= 65) return SystemStatus.WARNING;
  return SystemStatus.STABLE;
}

function encodeProtocolActionItems(protocol: AntiChaosProtocol): string[] {
  const items = [
    "KIND|ANTI_CHAOS_PROTOCOL_V2",
    `HORIZON_HOURS|${protocol.horizonHours}`,
    `MAIN|${protocol.brief.mainPriority}`,
    `SECONDARY|${protocol.brief.secondary[0]}`,
    `SECONDARY|${protocol.brief.secondary[1]}`,
    `MANDATORY_RECOVERY|${protocol.brief.mandatoryRecovery}`,
    ...protocol.brief.cutList.map((line) => `CUT|${line}`),
    `EXPECTED_EFFECTS|${JSON.stringify(protocol.brief.expectedEffects)}`,
    `ACTIONS|${JSON.stringify(protocol.actions)}`,
    `IMPACT_AT_HORIZON|${JSON.stringify(protocol.impact)}`,
    `WHY|${JSON.stringify(protocol.why)}`,
    `DETECTED|${JSON.stringify(protocol.detected)}`,
    `PATTERN_INFLUENCE|${JSON.stringify(protocol.patternInfluence)}`,
  ];

  return items;
}

export async function persistAntiChaosProtocol(protocol: AntiChaosProtocol): Promise<void> {
  const day = toUtcDateOnly(protocol.dateISO);
  const systemStatus = resolveSystemStatus(protocol.impact.protocolAtHorizon.risk);
  const reasons = [
    "ProtocolV2",
    `Pattern:${protocol.detected.pattern}`,
    `Mode:${protocol.patternInfluence.systemMode}`,
  ];
  const actionItems = encodeProtocolActionItems(protocol);

  await prisma.antiChaosPlan.upsert({
    where: {
      userId_date: {
        userId: protocol.userId,
        date: day,
      },
    },
    update: {
      systemStatus,
      reasons,
      actionItems,
      isResolved: false,
      resolvedDate: null,
    },
    create: {
      userId: protocol.userId,
      date: day,
      systemStatus,
      reasons,
      actionItems,
      isResolved: false,
      resolvedDate: null,
    },
  });
}
