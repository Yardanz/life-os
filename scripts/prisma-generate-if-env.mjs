import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL?.trim();
const requireDatabaseUrl = process.argv.includes("--require-db");

if (!databaseUrl) {
  if (requireDatabaseUrl) {
    console.error("DATABASE_URL missing at build; Prisma types cannot be generated");
    process.exit(1);
  }
  console.log("Skipping prisma generate (DATABASE_URL not set)");
  process.exit(0);
}

const child =
  process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", "npx prisma generate"], {
        stdio: "inherit",
        env: process.env,
      })
    : spawn("npx", ["prisma", "generate"], {
        stdio: "inherit",
        env: process.env,
      });

child.on("close", (code) => {
  process.exit(code ?? 1);
});

child.on("error", () => {
  process.exit(1);
});
