import { prisma } from "@/lib/prisma";
import { getRecentSystemErrors, getSystemErrorCountSince, type LoggedSystemError } from "@/lib/obs";
import { isProtocolActive } from "@/lib/protocol/protocolHelpers";

export type HealthWindow = "24h" | "7d";

export type HealthMetrics = {
  nowISO: string;
  selectedWindow: HealthWindow;
  operators: {
    totalUsers: number;
    newUsers7d: number;
    activeUsers24h: number;
    activeUsersSelectedWindow: number;
  };
  checkins: {
    checkins24h: number;
    checkins7d: number;
    avgPerActiveUser24h: number | null;
  };
  guardrails: {
    open: number;
    caution: number;
    lockdown: number;
    unavailable: number;
  };
  protocol: {
    activeProtocolUsers: number;
    activeProtocolRatio: number | null;
    protocolAppliesSelectedWindow: number;
  };
  billing: {
    paidOrdersSelectedWindow: number;
    pendingOrdersSelectedWindow: number;
    activeEntitlements: number;
    invalidSignatureCount: number | null;
  };
  errors: {
    available: boolean;
    countSelectedWindow: number;
    recent: LoggedSystemError[];
    storageNote: string;
  };
};

export function parseHealthWindow(raw: string | null | undefined): HealthWindow {
  return raw === "7d" ? "7d" : "24h";
}

function getWindowStart(window: HealthWindow, now: Date): Date {
  const hours = window === "7d" ? 24 * 7 : 24;
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export async function getHealthMetrics(window: HealthWindow): Promise<HealthMetrics> {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sinceSelected = getWindowStart(window, now);

  const [
    totalUsers,
    newUsers7d,
    checkins24h,
    checkins7d,
    active24hRows,
    activeSelectedRows,
    protocolAppliesWindow,
    paidOrdersSelectedWindow,
    pendingOrdersSelectedWindow,
    activeEntitlements,
  ] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: since7d } } }),
      prisma.dailyCheckIn.count({ where: { createdAt: { gte: since24h } } }),
      prisma.dailyCheckIn.count({ where: { createdAt: { gte: since7d } } }),
      prisma.dailyCheckIn.findMany({
        where: { createdAt: { gte: since24h } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.dailyCheckIn.findMany({
        where: { createdAt: { gte: sinceSelected } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.protocolRun.count({
        where: {
          appliedAt: {
            gte: sinceSelected,
            lte: now,
          },
        },
      }),
      prisma.billingOrder.count({
        where: {
          status: "PAID",
          updatedAt: { gte: sinceSelected, lte: now },
        },
      }),
      prisma.billingOrder.count({
        where: {
          status: { in: ["CREATED", "INVOICE_CREATED", "PENDING", "PARTIAL"] },
          updatedAt: { gte: sinceSelected, lte: now },
        },
      }),
      prisma.entitlement.count({
        where: {
          key: "OPERATOR_LICENSE",
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
      }),
    ]);

  const activeUserIds24h = active24hRows.map((row) => row.userId);
  const activeUserIdsSelected = activeSelectedRows.map((row) => row.userId);

  let open = 0;
  let caution = 0;
  let lockdown = 0;
  let unavailable = activeUserIdsSelected.length;

  let activeProtocolUsers = 0;
  if (activeUserIdsSelected.length > 0) {
    const [latestGuardrailRows, activeProtocolCandidates] = await Promise.all([
      prisma.protocolRun.findMany({
        where: { userId: { in: activeUserIdsSelected } },
        orderBy: [{ userId: "asc" }, { createdAt: "desc" }],
        select: {
          userId: true,
          guardrailState: true,
        },
      }),
      prisma.protocolRun.findMany({
        where: {
          userId: { in: activeUserIdsSelected },
          appliedAt: { not: null, gte: new Date(now.getTime() - 72 * 60 * 60 * 1000) },
        },
        select: {
          userId: true,
          appliedAt: true,
          horizonHours: true,
        },
      }),
    ]);

    const latestByUser = new Map<string, "OPEN" | "CAUTION" | "LOCKDOWN" | string>();
    for (const row of latestGuardrailRows) {
      if (!latestByUser.has(row.userId)) {
        latestByUser.set(row.userId, row.guardrailState);
      }
    }

    unavailable = 0;
    for (const userId of activeUserIdsSelected) {
      const guardrail = latestByUser.get(userId);
      if (!guardrail) {
        unavailable += 1;
      } else if (guardrail === "OPEN") {
        open += 1;
      } else if (guardrail === "CAUTION") {
        caution += 1;
      } else if (guardrail === "LOCKDOWN") {
        lockdown += 1;
      } else {
        unavailable += 1;
      }
    }

    const activeSet = new Set<string>();
    for (const row of activeProtocolCandidates) {
      if (row.appliedAt && isProtocolActive(row, now)) {
        activeSet.add(row.userId);
      }
    }
    activeProtocolUsers = activeSet.size;
  }

  const activeUsers24h = activeUserIds24h.length;
  const activeUsersSelectedWindow = activeUserIdsSelected.length;
  const avgPerActiveUser24h = activeUsers24h > 0 ? checkins24h / activeUsers24h : null;
  const activeProtocolRatio =
    activeUsersSelectedWindow > 0 ? (activeProtocolUsers / activeUsersSelectedWindow) * 100 : null;

  return {
    nowISO: now.toISOString(),
    selectedWindow: window,
    operators: {
      totalUsers,
      newUsers7d,
      activeUsers24h,
      activeUsersSelectedWindow,
    },
    checkins: {
      checkins24h,
      checkins7d,
      avgPerActiveUser24h,
    },
    guardrails: {
      open,
      caution,
      lockdown,
      unavailable,
    },
    protocol: {
      activeProtocolUsers,
      activeProtocolRatio,
      protocolAppliesSelectedWindow: protocolAppliesWindow,
    },
    billing: {
      paidOrdersSelectedWindow,
      pendingOrdersSelectedWindow,
      activeEntitlements,
      invalidSignatureCount: null,
    },
    errors: {
      available: true,
      countSelectedWindow: getSystemErrorCountSince(sinceSelected),
      recent: getRecentSystemErrors({ since: sinceSelected, limit: 10 }),
      storageNote: "In-memory process buffer (resets on process restart).",
    },
  };
}
