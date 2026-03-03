import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

function readDatabaseUrlFromEnvFile(fileName) {
  const filePath = join(process.cwd(), fileName);
  if (!existsSync(filePath)) return null;
  const line = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith("DATABASE_URL=") && !item.trim().startsWith("#"));
  if (!line) return null;
  return line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

const databaseUrl =
  process.env.DATABASE_URL?.trim() || readDatabaseUrlFromEnvFile(".env") || readDatabaseUrlFromEnvFile(".env.local");
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed billing plans.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const plans = [
    {
      code: "OPERATOR_MONTHLY",
      title: "Operator License - Monthly",
      priceAmount: "19.00",
      priceCurrency: "USD",
      periodDays: 30,
    },
    {
      code: "OPERATOR_YEARLY",
      title: "Operator License - Yearly",
      priceAmount: "190.00",
      priceCurrency: "USD",
      periodDays: 365,
    },
  ];

  for (const plan of plans) {
    await prisma.billingPlan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        title: plan.title,
        priceAmount: plan.priceAmount,
        priceCurrency: plan.priceCurrency,
        periodDays: plan.periodDays,
        isActive: true,
      },
      update: {
        title: plan.title,
        priceAmount: plan.priceAmount,
        priceCurrency: plan.priceCurrency,
        periodDays: plan.periodDays,
        isActive: true,
      },
    });
  }

  console.warn("Billing plans seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
