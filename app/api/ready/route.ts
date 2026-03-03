import { NextResponse } from "next/server";
import { assertEnv } from "@/lib/env";
import { generateErrorId, logSystemError } from "@/lib/obs";

export const runtime = "nodejs";

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function getHeaderToken(request: Request): string | null {
  const header = request.headers.get("x-readiness-token");
  return header && header.trim().length > 0 ? header.trim() : null;
}

export async function GET(request: Request) {
  const requiredToken = process.env.READINESS_TOKEN;

  // Token-gated to avoid exposing infrastructure readiness publicly.
  if (!hasValue(requiredToken)) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const providedToken = getHeaderToken(request);
  if (!providedToken || providedToken !== requiredToken) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    assertEnv();

    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const errorId = generateErrorId();
    logSystemError({
      errorId,
      scope: "api",
      name: "api.ready.GET",
      message: error instanceof Error ? error.message : "Readiness check failed.",
      path: "/api/ready",
      meta: { method: "GET" },
    });

    return NextResponse.json({ ok: false, error: "NOT_READY", errorId }, { status: 503 });
  }
}
