import { installDemoDb } from "../scripts/copy-demo-db.mjs";
import { applyRuntimeEnv } from "./runtime-env";
import { getPrisma, resetPrisma } from "./db";
import { STORE_CATEGORIES, categorySlug } from "./store-categories";
import { backfillStoreCodes } from "./store-code";
import { ensureOpsReferralCodes } from "./referral";
import { BRAND_NAME } from "./brand-name";
import { DEFAULT_STORE_CREDIT, DEFAULT_STORE_RATING, STORE_RATING_MAX } from "./store-score";
import { bumpGrowthCatalogCap, syncDistributionCatalog } from "./sync-distribution-catalog";

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
  type TableName = "User" | "Merchant" | "MerchantApplication" | "SupportMessage";
  type ColumnRow = { name: string };

  async function tableColumns(table: TableName) {
    const rows = await prisma.$queryRawUnsafe<ColumnRow[]>(`PRAGMA table_info("${table}")`);
    return new Set(rows.map((row) => row.name));
  }

  let supportMessageColumns = new Set<string>();
  try {
    supportMessageColumns = await tableColumns("SupportMessage");
  } catch {
    supportMessageColumns = new Set();
  }

  const columns: Record<TableName, Set<string>> = {
    User: await tableColumns("User"),
    Merchant: await tableColumns("Merchant"),
    MerchantApplication: await tableColumns("MerchantApplication"),
    SupportMessage: supportMessageColumns,
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
    ["SupportMessage", "sessionId", `ALTER TABLE "SupportMessage" ADD COLUMN "sessionId" TEXT`],
    ["SupportMessage", "attachmentKind", `ALTER TABLE "SupportMessage" ADD COLUMN "attachmentKind" TEXT NOT NULL DEFAULT ''`],
    ["SupportMessage", "attachmentMime", `ALTER TABLE "SupportMessage" ADD COLUMN "attachmentMime" TEXT NOT NULL DEFAULT ''`],
    ["SupportMessage", "attachmentPath", `ALTER TABLE "SupportMessage" ADD COLUMN "attachmentPath" TEXT NOT NULL DEFAULT ''`],
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
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SupportSession" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "threadId" TEXT NOT NULL,
        "merchantId" TEXT NOT NULL,
        "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" DATETIME NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "welcomeSentAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SupportSession_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "SupportThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SupportSession_merchantId_status_idx" ON "SupportSession"("merchantId", "status")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SupportSession_threadId_idx" ON "SupportSession"("threadId")`,
    );
  } catch (error) {
    console.warn("[harbor] SupportSession table skipped", error);
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
    const scale = await prisma.setting.findUnique({ where: { key: "storeRatingScaleV2" } });
    if (!scale) {
      await prisma.merchant.updateMany({
        where: { rating: { gt: STORE_RATING_MAX } },
        data: { rating: DEFAULT_STORE_RATING },
      });
      await prisma.setting.create({ data: { key: "storeRatingScaleV2", value: "1" } });
    }
  } catch (error) {
    console.warn("[harbor] store score backfill skipped", error);
  }
  try {
    await bumpGrowthCatalogCap(prisma);
  } catch (error) {
    console.warn("[harbor] Growth catalog cap skipped", error);
  }
  try {
    const northline = await prisma.merchant.findUnique({
      where: { slug: "northline-outfitters" },
      include: { _count: { select: { products: true } } },
    });
    if (northline && northline._count.products < 500) {
      await syncDistributionCatalog(prisma);
    }
    const photos = await prisma.setting.findUnique({ where: { key: "distributionPhotosV4" } });
    if (!photos) {
      await syncDistributionCatalog(prisma);
      await prisma.setting.create({ data: { key: "distributionPhotosV4", value: "1" } });
    }
    const flag = await prisma.setting.findUnique({ where: { key: "distributionCatalogV1" } });
    if (!flag) {
      await prisma.setting.create({ data: { key: "distributionCatalogV1", value: "1" } });
    }
  } catch (error) {
    console.warn("[harbor] distribution catalog backfill skipped", error);
  }
  try {
    const name = await prisma.setting.findUnique({ where: { key: "storeName" } });
    if (!name) {
      await prisma.setting.create({ data: { key: "storeName", value: BRAND_NAME } });
    } else if (name.value === "Harbor Commerce" || name.value === "TikiTok Shop") {
      await prisma.setting.update({ where: { key: "storeName" }, data: { value: BRAND_NAME } });
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
