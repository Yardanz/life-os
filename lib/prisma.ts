import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { assertEnv } from "@/lib/env.server";
import { startTiming } from "@/lib/observability/timing";

type PrismaSingleton = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaSingleton;
};

function parseDotEnvDatabaseUrl(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf8");
  const line = content
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith("DATABASE_URL=") && !item.trim().startsWith("#"));
  if (!line) return null;
  const rawValue = line.slice(line.indexOf("=") + 1).trim();
  if (rawValue.length === 0) return null;
  return rawValue.replace(/^['"]|['"]$/g, "");
}

function validateDatabaseUrlOrThrow() {
  const runtimeValue = process.env.DATABASE_URL?.trim() ?? "";
  const expectedEnvPath = join(process.cwd(), ".env");
  const devDotEnvValue = parseDotEnvDatabaseUrl(expectedEnvPath);
  const validProtocol = /^(postgresql|postgres):\/\//i.test(runtimeValue);

  if (!runtimeValue || !validProtocol) {
    throw new Error(
      [
        "[prisma] Invalid DATABASE_URL.",
        `Expected protocol: postgresql:// or postgres://`,
        `Expected dev source file: ${expectedEnvPath}`,
        `Example: DATABASE_URL=postgresql://<user>:<password>@localhost:5434/<database>?schema=public`,
        "If you previously generated Prisma client with --no-engine, regenerate with: npx prisma generate",
      ].join("\n")
    );
  }

  if (process.env.NODE_ENV !== "production" && devDotEnvValue && runtimeValue !== devDotEnvValue) {
    throw new Error(
      [
        "[prisma] DATABASE_URL mismatch in development.",
        `Runtime DATABASE_URL differs from ${expectedEnvPath}.`,
        "Use exactly one source of truth in dev: .env",
        "Remove conflicting shell/env overrides and restart dev server.",
      ].join("\n")
    );
  }
}

validateDatabaseUrlOrThrow();
assertEnv();

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const isSupabasePooler = /pooler\.supabase\.com/i.test(databaseUrl);
const isSupabaseDirect = /(^|@)db\.[^.]+\.supabase\.co(?::\d+)?/i.test(databaseUrl);

function buildPoolConnectionString(rawUrl: string, forPooler: boolean): string {
  if (!forPooler) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    // Prevent pg from forcing certificate validation mode from URL params.
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("sslcert");
    parsed.searchParams.delete("sslkey");
    parsed.searchParams.delete("sslrootcert");
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const pool = new Pool({
  connectionString: buildPoolConnectionString(databaseUrl, isSupabasePooler),
  // Serverless-friendly defaults to reduce upstream pool pressure on Vercel.
  max: process.env.NODE_ENV === "production" ? 1 : 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
  keepAlive: true,
  // Supabase pooler can present cert chains not trusted by default Node CA bundle in serverless envs.
  // Keep TLS enabled but skip CA verification only for pooler host connections.
  ssl: isSupabasePooler ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);

if (process.env.NODE_ENV === "production" && isSupabaseDirect) {
  console.warn("[prisma] DATABASE_URL points to Supabase direct host. Prefer Session Pooler for Vercel runtime.");
}

function createPrismaClient(): PrismaSingleton {
  const client = new PrismaClient({
    log: ["warn", "error"],
    adapter,
  });

  if (process.env.PERF_TIMING_LOG === "1") {
    return client.$extends({
      query: {
        user: {
          async upsert({ query, args }) {
            const timer = startTiming("prisma.user.upsert", {
              whereKeys: Object.keys((args?.where ?? {}) as Record<string, unknown>).join(",") || "none",
            });
            try {
              const result = await query(args);
              timer.end({ ok: true });
              return result;
            } catch (error) {
              timer.end({ ok: false, error: error instanceof Error ? error.name : "unknown" });
              throw error;
            }
          },
        },
      },
    }) as PrismaSingleton;
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
