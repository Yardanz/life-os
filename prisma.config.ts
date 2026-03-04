import "dotenv/config";
import { defineConfig } from "prisma/config";

const runtimeDatabaseUrl = process.env.DATABASE_URL?.trim();
const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim();

if (!runtimeDatabaseUrl && !directDatabaseUrl) {
  throw new Error("DATABASE_URL or DIRECT_DATABASE_URL must be set.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma CLI (migrate/status/deploy) should prefer direct DB URL when available.
  datasource: {
    url: directDatabaseUrl || runtimeDatabaseUrl,
  },
});
