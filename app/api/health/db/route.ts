import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateErrorId, logSystemError } from "@/lib/obs";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        ok: true,
        service: "life-os",
        check: "db",
        ts: new Date().toISOString(),
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
      name: "api.health.db.GET",
      message: error instanceof Error ? error.message : "Database health check failed.",
      path: "/api/health/db",
      meta: { method: "GET" },
    });
    return NextResponse.json(
      { ok: false, error: "DB_UNREACHABLE", errorId, message: "Database connectivity check failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
