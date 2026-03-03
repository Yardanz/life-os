import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID } from "@/lib/demoMode";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SystemEvent = {
  id: string;
  timestamp: string;
  source: "checkin" | "protocol";
  type: "CHECK_IN_RECORDED" | "PROTOCOL_GENERATED" | "PROTOCOL_APPLIED";
  message: string;
  status?: "COMPLETED" | "GENERATED" | "APPLIED";
};

export async function GET(request: Request) {
  try {
    const demoMode = isDemoModeRequest(request);
    const session = await auth();
    const userId = demoMode ? LIVE_DEMO_USER_ID : session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (demoMode) {
      await ensureLiveDemoData();
    }

    const [checkins, protocols] = await Promise.all([
      prisma.dailyCheckIn.findMany({
        where: { userId },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.protocolRun.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          appliedAt: true,
          guardrailState: true,
          horizonHours: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const checkinEvents: SystemEvent[] = checkins.map((row) => ({
      id: `checkin:${row.id}`,
      timestamp: row.createdAt.toISOString(),
      source: "checkin",
      type: "CHECK_IN_RECORDED",
      message: "Daily check-in recorded.",
      status: "COMPLETED",
    }));

    const protocolEvents: SystemEvent[] = protocols.flatMap((row) => {
      const events: SystemEvent[] = [
        {
          id: `protocol:generated:${row.id}`,
          timestamp: row.createdAt.toISOString(),
          source: "protocol",
          type: "PROTOCOL_GENERATED",
          message: `Protocol generated: ${row.guardrailState} (${row.horizonHours}h).`,
          status: "GENERATED",
        },
      ];

      if (row.appliedAt) {
        events.push({
          id: `protocol:applied:${row.id}`,
          timestamp: row.appliedAt.toISOString(),
          source: "protocol",
          type: "PROTOCOL_APPLIED",
          message: "Protocol applied: constraints activated.",
          status: "APPLIED",
        });
      }

      return events;
    });

    const events = [...checkinEvents, ...protocolEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return NextResponse.json({ ok: true, data: events }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load system events.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
