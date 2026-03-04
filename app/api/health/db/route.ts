import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateErrorId, logSystemError } from "@/lib/obs";

export const runtime = "nodejs";

function getDbUrlDiagnostics() {
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  if (!raw) {
    return {
      hasDatabaseUrl: false,
      dbHost: null as string | null,
      dbPort: null as number | null,
      dbName: null as string | null,
      hasSslMode: false,
      sslMode: null as string | null,
    };
  }

  try {
    const parsed = new URL(raw);
    const params = parsed.searchParams;
    return {
      hasDatabaseUrl: true,
      dbHost: parsed.hostname,
      dbPort: parsed.port ? Number(parsed.port) : null,
      dbName: parsed.pathname.replace(/^\/+/, "") || null,
      hasSslMode: params.has("sslmode"),
      sslMode: params.get("sslmode"),
    };
  } catch {
    return {
      hasDatabaseUrl: true,
      dbHost: null as string | null,
      dbPort: null as number | null,
      dbName: null as string | null,
      hasSslMode: false,
      sslMode: null as string | null,
    };
  }
}

export async function GET() {
  const urlDiag = getDbUrlDiagnostics();
  const hasDatabaseUrl = urlDiag.hasDatabaseUrl;
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
        dbHost: urlDiag.dbHost,
        dbPort: urlDiag.dbPort,
        dbName: urlDiag.dbName,
        hasSslMode: urlDiag.hasSslMode,
        sslMode: urlDiag.sslMode,
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
      meta: {
        method: "GET",
        hasDatabaseUrl,
        hasDirectUrl,
        hasPoolerUrl,
        dbHost: urlDiag.dbHost,
        dbPort: urlDiag.dbPort,
        hasSslMode: urlDiag.hasSslMode,
      },
    });

    const errorObject = error as {
      code?: string;
      message?: string;
      severity?: string;
      originalCode?: string;
      originalMessage?: string;
    };

    return NextResponse.json(
      {
        ok: false,
        code: "DB_UNREACHABLE",
        messageId: errorId,
        driverCode: errorObject.code ?? null,
        driverSeverity: errorObject.severity ?? null,
        driverOriginalCode: errorObject.originalCode ?? null,
        driverMessage: errorObject.originalMessage ?? errorObject.message ?? null,
        hasDatabaseUrl,
        hasDirectUrl,
        hasPoolerUrl,
        dbHost: urlDiag.dbHost,
        dbPort: urlDiag.dbPort,
        dbName: urlDiag.dbName,
        hasSslMode: urlDiag.hasSslMode,
        sslMode: urlDiag.sslMode,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
