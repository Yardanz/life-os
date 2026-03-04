import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { assertEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Serverless-friendly defaults to reduce upstream pool pressure on Vercel.
  max: process.env.NODE_ENV === "production" ? 1 : 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
  keepAlive: true,
});
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
