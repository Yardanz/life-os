import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateErrorId, logSystemError } from "@/lib/obs";

export const runtime = "nodejs";

export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasDirectUrl = Boolean(process.env.DIRECT_DATABASE_URL?.trim());
  const hasPoolerUrl = /pooler\.supabase\.com/i.test(process.env.DATABASE_URL ?? "");

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        ok: true,
        hasDatabaseUrl,
        hasDirectUrl,
        hasPoolerUrl,
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
      meta: { method: "GET", hasDatabaseUrl, hasDirectUrl, hasPoolerUrl },
    });
    return NextResponse.json(
      {
        ok: false,
        code: "DB_UNREACHABLE",
        messageId: errorId,
        hasDatabaseUrl,
        hasDirectUrl,
        hasPoolerUrl,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
