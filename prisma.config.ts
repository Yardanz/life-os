import "dotenv/config";
import { defineConfig } from "prisma/config";

const runtimeDatabaseUrl = process.env.DATABASE_URL?.trim();
const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma CLI (migrate/status/deploy) should prefer direct DB URL when available.
  // Keep datasource optional so `prisma generate` can run even before envs are injected.
  datasource: directDatabaseUrl || runtimeDatabaseUrl ? { url: directDatabaseUrl || runtimeDatabaseUrl } : undefined,
});
