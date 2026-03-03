import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { requireProPlan } from "@/lib/api/plan";
import { ensureLiveDemoData } from "@/lib/demo/seedLiveDemo";
import { isDemoModeRequest, LIVE_DEMO_USER_ID, requireWritableMode } from "@/lib/demoMode";
import { generateErrorId, logSystemError } from "@/lib/obs";
import { scenarioSavePayloadSchema, scenariosQuerySchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/telemetry";

function isScenarioSnapshotTableMissing(error: unknown): boolean {
  const e = error as {
    code?: string;
    message?: string;
    meta?: { table?: string; modelName?: string };
  } | null;
  if (!e) return false;
  if (e.code === "P2021") return true;
  const table = typeof e.meta?.table === "string" ? e.meta.table : "";
  const modelName = typeof e.meta?.modelName === "string" ? e.meta.modelName : "";
  const message = typeof e.message === "string" ? e.message : "";
  return (
    table.includes("ScenarioSnapshot") ||
    modelName.includes("ScenarioSnapshot") ||
    (message.includes("ScenarioSnapshot") && message.includes("does not exist"))
  );
}

export async function GET(request: Request) {
  try {
    const demoMode = isDemoModeRequest(request);
    const session = await auth();
    const sessionUserId = demoMode ? LIVE_DEMO_USER_ID : session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (demoMode) {
      await ensureLiveDemoData();
    }
    const { searchParams } = new URL(request.url);
    const payload = scenariosQuerySchema.parse({
      userId: sessionUserId,
      limit: searchParams.get("limit") ?? undefined,
    });
    const user = await requireProPlan(payload.userId, request);
    const rows = await prisma.scenarioSnapshot.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: payload.limit ?? 20,
      select: {
        id: true,
        createdAt: true,
        name: true,
        horizonDays: true,
        tags: true,
        baseDateISO: true,
        source: true,
        inputModifiers: true,
        projectionResult: true,
        patternContext: true,
        calibrationConfidence: true,
      },
    });
    return NextResponse.json({ ok: true, data: { scenarios: rows } }, { status: 200 });
  } catch (error) {
    if (isScenarioSnapshotTableMissing(error)) {
      return NextResponse.json(
        {
          ok: true,
          data: { scenarios: [] },
        },
        { status: 200 }
      );
    }
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let logUserId: string | null = null;
  try {
    requireWritableMode(request);
    const session = await auth();
    const sessionUserId = session?.user?.id;
    logUserId = sessionUserId ?? null;
    if (!sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const payload = scenarioSavePayloadSchema.parse(await request.json());
    const user = await requireProPlan(sessionUserId, request);
    const created = await prisma.scenarioSnapshot.create({
      data: {
        userId: user.id,
        name: payload.name,
        horizonDays: payload.horizonDays,
        tags: payload.tags,
        baseDateISO: payload.baseDateISO,
        source: payload.source,
        inputModifiers: payload.inputModifiers as Prisma.InputJsonValue,
        projectionResult: payload.projectionResult as Prisma.InputJsonValue,
        patternContext: payload.patternContext as Prisma.InputJsonValue,
        calibrationConfidence: payload.calibrationConfidence,
      },
      select: {
        id: true,
        createdAt: true,
        name: true,
        horizonDays: true,
        tags: true,
        baseDateISO: true,
        source: true,
        inputModifiers: true,
        projectionResult: true,
        patternContext: true,
        calibrationConfidence: true,
      },
    });
    recordEvent("scenario_saved");
    return NextResponse.json({ ok: true, data: { scenario: created } }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.scenarios.POST",
      message:
        error instanceof Error
          ? error.message
          : isScenarioSnapshotTableMissing(error)
            ? "ScenarioSnapshot table missing"
            : "Failed to save scenario.",
      path: "/api/scenarios",
      userId: logUserId,
      meta: { method: "POST" },
    });
    return NextResponse.json({ ok: false, error: "SYSTEM_FAULT", errorId }, { status: 500 });
  }
}
