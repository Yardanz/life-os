import { Pool } from "pg";

function parseTarget() {
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg ? targetArg.split("=")[1] : "runtime";
  if (target !== "runtime" && target !== "migrate") {
    throw new Error(`Unsupported target "${target}". Use --target=runtime or --target=migrate.`);
  }
  return target;
}

function getConnectionString(target) {
  const runtime = process.env.DATABASE_URL?.trim() ?? "";
  const direct = process.env.DIRECT_DATABASE_URL?.trim() ?? "";
  if (target === "runtime") return runtime;
  return direct || runtime;
}

function sanitizeConnectionInfo(connectionString) {
  const parsed = new URL(connectionString);
  return {
    host: parsed.hostname,
    port: parsed.port || (parsed.protocol === "postgresql:" ? "5432" : ""),
    databaseFromUrl: parsed.pathname.replace(/^\//, "") || null,
  };
}

async function main() {
  const target = parseTarget();
  const connectionString = getConnectionString(target);
  if (!connectionString) {
    throw new Error(
      target === "runtime"
        ? "DATABASE_URL is required for --target=runtime."
        : "DIRECT_DATABASE_URL or DATABASE_URL is required for --target=migrate."
    );
  }

  const requested = sanitizeConnectionInfo(connectionString);
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(
      "SELECT current_database() AS db, current_schema() AS schema, inet_server_addr()::text AS server_ip, inet_server_port() AS port"
    );
    const row = result.rows[0] ?? {};
    console.log(
      JSON.stringify(
        {
          ok: true,
          target,
          requestedHost: requested.host,
          requestedPort: requested.port,
          requestedDatabase: requested.databaseFromUrl,
          db: row.db ?? null,
          schema: row.schema ?? null,
          serverIp: row.server_ip ?? null,
          serverPort: row.port ?? null,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : "db-info failed",
      },
      null,
      2
    )
  );
  process.exit(1);
});
