import "dotenv/config";
import { defineConfig } from "prisma/config";

const runtimeDatabaseUrl = process.env.DATABASE_URL?.trim();
const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim();
const cliTarget = (process.env.PRISMA_CLI_TARGET ?? "runtime").trim().toLowerCase();
const useDirect = cliTarget === "direct";
const selectedCliUrl = useDirect
  ? directDatabaseUrl || runtimeDatabaseUrl
  : runtimeDatabaseUrl || directDatabaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma CLI default target is runtime URL (pooler). To force direct URL, set PRISMA_CLI_TARGET=direct.
  // Keep datasource optional so `prisma generate` can run even before envs are injected.
  datasource: selectedCliUrl ? { url: selectedCliUrl } : undefined,
});
