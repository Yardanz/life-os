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
        status: "healthy",
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
      {
        ok: false,
        code: "DB_UNREACHABLE",
        messageId: errorId,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
