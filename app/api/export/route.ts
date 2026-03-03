import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logSystemError, generateErrorId } from "@/lib/obs";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/telemetry";

export const runtime = "nodejs";

type ExportFormat = "json" | "csv";
type ExportRange = "7" | "30" | "all";

type ParsedCheckinMetrics = {
  sleepHours?: number;
  sleepQuality?: number;
  workout?: number;
  deepWorkMin?: number;
  learningMin?: number;
  moneyDelta?: number;
};

function parseFormat(raw: string | null): ExportFormat {
  if (raw === null || raw === "json") return "json";
  if (raw === "csv") return "csv";
  throw new Error("Invalid format. Expected json or csv.");
}

function parseRange(raw: string | null): ExportRange {
  if (raw === null || raw === "30") return "30";
  if (raw === "7" || raw === "all") return raw;
  throw new Error("Invalid range. Expected 7, 30, or all.");
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function maskUserId(userId: string): string {
  if (userId.length <= 4) return "****";
  return `****${userId.slice(-4)}`;
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
      learningMin: typeof parsed.learningMin === "number" ? parsed.learningMin : undefined,
      moneyDelta: typeof parsed.moneyDelta === "number" ? parsed.moneyDelta : undefined,
    };
  } catch {
    return {};
  }
}

function startDateForRange(range: ExportRange): Date | null {
  if (range === "all") return null;
  const days = range === "7" ? 7 : 30;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function GET(request: Request) {
  let logUserId: string | null = null;
  try {
    const session = await auth();
    const userId = session?.user?.id;
    logUserId = userId ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    let format: ExportFormat;
    let range: ExportRange;
    try {
      format = parseFormat(searchParams.get("format"));
      range = parseRange(searchParams.get("range"));
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : "Invalid export params.";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
    const rangeStart = startDateForRange(range);
    const maxRows = range === "all" ? 365 : range === "30" ? 30 : 7;

    const checkins = await prisma.dailyCheckIn.findMany({
      where: {
        userId,
        ...(rangeStart ? { date: { gte: rangeStart } } : {}),
      },
      select: {
        id: true,
        date: true,
        createdAt: true,
        updatedAt: true,
        systemStatus: true,
        stressLevel: true,
        bedtimeMinutes: true,
        wakeTimeMinutes: true,
        notes: true,
      },
      orderBy: { date: "desc" },
      take: maxRows,
    });

    const snapshots = await prisma.statSnapshot.findMany({
      where: {
        userId,
        ...(rangeStart ? { date: { gte: rangeStart } } : {}),
      },
      select: {
        date: true,
        lifeScore: true,
      },
      orderBy: { date: "desc" },
      take: maxRows,
    });

    const protocols = await prisma.protocolRun.findMany({
      where: {
        userId,
        ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        horizonHours: true,
        mode: true,
        guardrailState: true,
        confidence: true,
        appliedAt: true,
        outcome: true,
      },
      orderBy: { createdAt: "desc" },
      take: maxRows,
    });

    const snapshotByDay = new Map(
      snapshots.map((row) => [formatDateOnly(row.date), Number(row.lifeScore)])
    );

    const exportedCheckins = checkins.map((row) => {
      const parsed = parseCheckinMetrics(row.notes);
      const dayKey = formatDateOnly(row.date);
      return {
        id: row.id,
        dayKey,
        date: row.date.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        systemStatus: row.systemStatus,
        stress: row.stressLevel,
        bedtimeMinutes: row.bedtimeMinutes,
        wakeTimeMinutes: row.wakeTimeMinutes,
        sleepHours: parsed.sleepHours ?? null,
        sleepQuality: parsed.sleepQuality ?? null,
        deepWorkMin: parsed.deepWorkMin ?? null,
        learningMin: parsed.learningMin ?? null,
        workout: parsed.workout ?? null,
        moneyDelta: parsed.moneyDelta ?? null,
        lifeScore: snapshotByDay.get(dayKey) ?? null,
      };
    });

    const guardrail = protocols.map((row) => ({
      at: row.createdAt.toISOString(),
      state: row.guardrailState,
      source: "protocolRun",
    }));

    if (format === "csv") {
      const headers = [
        "type",
        "id",
        "dayKey",
        "date",
        "createdAt",
        "updatedAt",
        "systemStatus",
        "stress",
        "bedtimeMinutes",
        "wakeTimeMinutes",
        "sleepHours",
        "sleepQuality",
        "deepWorkMin",
        "learningMin",
        "workout",
        "moneyDelta",
        "lifeScore",
        "protocolMode",
        "protocolGuardrail",
        "protocolHorizonHours",
        "protocolAppliedAt",
        "protocolConfidence",
      ];

      const checkinRows = exportedCheckins.map((row) =>
        [
          "checkin",
          row.id,
          row.dayKey,
          row.date,
          row.createdAt,
          row.updatedAt,
          row.systemStatus,
          row.stress,
          row.bedtimeMinutes,
          row.wakeTimeMinutes,
          row.sleepHours,
          row.sleepQuality,
          row.deepWorkMin,
          row.learningMin,
          row.workout,
          row.moneyDelta,
          row.lifeScore,
          "",
          "",
          "",
          "",
          "",
        ]
          .map(csvEscape)
          .join(",")
      );

      const protocolRows = protocols.map((row) =>
        [
          "protocol",
          row.id,
          "",
          "",
          row.createdAt.toISOString(),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          row.mode,
          row.guardrailState,
          row.horizonHours,
          row.appliedAt ? row.appliedAt.toISOString() : "",
          row.confidence,
        ]
          .map(csvEscape)
          .join(",")
      );

      const csvBody = [headers.join(","), ...checkinRows, ...protocolRows].join("\n");
      recordEvent("export_generated");
      return new Response(csvBody, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    recordEvent("export_generated");
    return NextResponse.json(
      {
        meta: {
          exportedAt: new Date().toISOString(),
          range,
          format,
          userId: maskUserId(userId),
          version: "lifeos-export-v1",
          maxRows,
        },
        checkins: exportedCheckins,
        protocols: protocols.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
        })),
        guardrail,
        notes: "Derived metrics may be recalculated; export contains stored values.",
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.export.GET",
      message: error instanceof Error ? error.message : "Export failed.",
      userId: logUserId,
      path: "/api/export",
      meta: { method: "GET" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
