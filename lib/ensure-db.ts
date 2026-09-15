import { installDemoDb } from "../scripts/copy-demo-db.mjs";
import { applyRuntimeEnv } from "./runtime-env";
import { getPrisma, resetPrisma } from "./db";
import { STORE_CATEGORIES, categorySlug } from "./store-categories";
import { backfillStoreCodes } from "./store-code";
import { ensureOpsReferralCodes } from "./referral";
import { DEFAULT_STORE_CREDIT, DEFAULT_STORE_RATING } from "./store-score";

async function backfill() {
  const prisma = getPrisma();
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET walletReleased = 1 WHERE status = 'COMPLETED' AND walletReleased = 0`,
    );
  } catch (error) {
    console.warn("[harbor] walletReleased backfill skipped", error);
  }
  for (const name of STORE_CATEGORIES) {
    const slug = categorySlug(name);
    try {
      await prisma.category.upsert({
        where: { slug },
        create: { name, slug },
        update: { name },
      });
    } catch (error) {
      console.warn("[harbor] category backfill skipped", name, error);
    }
  }
  try {
    await backfillStoreCodes();
  } catch (error) {
    console.warn("[harbor] storeCode backfill skipped", error);
  }
  type TableName = "User" | "Merchant" | "MerchantApplication";
  type ColumnRow = { name: string };

  async function tableColumns(table: TableName) {
    const rows = await prisma.$queryRawUnsafe<ColumnRow[]>(`PRAGMA table_info("${table}")`);
    return new Set(rows.map((row) => row.name));
  }

  const columns: Record<TableName, Set<string>> = {
    User: await tableColumns("User"),
    Merchant: await tableColumns("Merchant"),
    MerchantApplication: await tableColumns("MerchantApplication"),
  };
  const needed: Array<[TableName, string, string]> = [
    ["User", "referralCode", `ALTER TABLE "User" ADD COLUMN "referralCode" TEXT`],
    ["Merchant", "cnicImageFront", `ALTER TABLE "Merchant" ADD COLUMN "cnicImageFront" TEXT NOT NULL DEFAULT ''`],
    ["Merchant", "cnicImageBack", `ALTER TABLE "Merchant" ADD COLUMN "cnicImageBack" TEXT NOT NULL DEFAULT ''`],
    ["Merchant", "referralCodeUsed", `ALTER TABLE "Merchant" ADD COLUMN "referralCodeUsed" TEXT NOT NULL DEFAULT ''`],
    ["Merchant", "referredByUserId", `ALTER TABLE "Merchant" ADD COLUMN "referredByUserId" TEXT`],
    ["Merchant", "creditScore", `ALTER TABLE "Merchant" ADD COLUMN "creditScore" INTEGER NOT NULL DEFAULT 100`],
    ["MerchantApplication", "referredByUserId", `ALTER TABLE "MerchantApplication" ADD COLUMN "referredByUserId" TEXT`],
    ["MerchantApplication", "referralCode", `ALTER TABLE "MerchantApplication" ADD COLUMN "referralCode" TEXT NOT NULL DEFAULT ''`],
  ];
  for (const [table, column, sql] of needed) {
    if (columns[table].has(column)) continue;
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (error) {
      console.warn("[harbor] column add skipped", table, column, error);
    }
  }
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode")`,
    );
  } catch (error) {
    console.warn("[harbor] referral index skipped", error);
  }
  try {
    await ensureOpsReferralCodes();
  } catch (error) {
    console.warn("[harbor] referral code backfill skipped", error);
  }
  try {
    const flag = await prisma.setting.findUnique({ where: { key: "storeScoreInitialized" } });
    if (!flag) {
      await prisma.merchant.updateMany({
        data: { rating: DEFAULT_STORE_RATING, creditScore: DEFAULT_STORE_CREDIT },
      });
      await prisma.setting.create({ data: { key: "storeScoreInitialized", value: "1" } });
    }
  } catch (error) {
    console.warn("[harbor] store score backfill skipped", error);
  }
  try {
    const name = await prisma.setting.findUnique({ where: { key: "storeName" } });
    if (!name) {
      await prisma.setting.create({ data: { key: "storeName", value: "TikiTok Shop" } });
    } else if (name.value === "Harbor Commerce") {
      await prisma.setting.update({ where: { key: "storeName" }, data: { value: "TikiTok Shop" } });
    }
  } catch (error) {
    console.warn("[harbor] storeName backfill skipped", error);
  }
}

export async function ensureDatabase() {
  applyRuntimeEnv();
  const root = process.cwd();
  const dest = installDemoDb(root);
  process.env.DATABASE_URL = `file:${dest}`;
  resetPrisma();

  try {
    const user = await getPrisma().user.findFirst({
      where: { email: "oscar.d@example.net" },
      select: { id: true },
    });
    if (user) {
      await backfill();
      return;
    }
    console.warn("[harbor] Demo admin missing; restoring packed SQLite.");
  } catch (error) {
    console.error("[harbor] SQLite not readable; restoring packed database.", error);
  }

  const restored = installDemoDb(root, { overwrite: true });
  process.env.DATABASE_URL = `file:${restored}`;
  resetPrisma();
  const admin = await getPrisma().user.findFirst({
    where: { email: "oscar.d@example.net" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("Demo database installed but admin user is missing.");
  }
  await backfill();
}
