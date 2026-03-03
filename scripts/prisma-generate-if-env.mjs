import { spawn } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.log("Skipping prisma generate (DATABASE_URL not set)");
  process.exit(0);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["prisma", "generate"], {
  stdio: "inherit",
  env: process.env,
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});

child.on("error", () => {
  process.exit(1);
});
