import { existingSqliteFiles, repoRoot, resolveLiveSqlite } from "../scripts/copy-demo-db.mjs";
import { applyRuntimeEnv } from "./runtime-env";
import { getPrisma, resetPrisma } from "./db";
import { STORE_CATEGORIES, categorySlug } from "./store-categories";
import { backfillStoreCodes } from "./store-code";
import { ensureOpsReferralCodes } from "./referral";
import { BRAND_NAME } from "./brand-name";
import { DEFAULT_STORE_CREDIT, DEFAULT_STORE_RATING, STORE_RATING_MAX } from "./store-score";
import { bumpGrowthCatalogCap, syncDistributionCatalog } from "./sync-distribution-catalog";
import { restoreOpsUsers, snapshotOpsUsers } from "./ops-users-store";
import { restoreStores, snapshotStores } from "./stores-persist";
import { pullRemotePersist } from "./remote-persist";
import { SUPER_ADMIN_PUBLIC_NAME } from "./staff-display";

async function backfill() {
  const prisma = getPrisma();
  try {
    await prisma.order.updateMany({
      where: {
        pickedAt: null,
        OR: [
          { status: "PAID", orderNumber: { startsWith: "HB-2026-PICKUP-" } },
          { status: "PROCESSING", notes: "Placed by super admin" },
        ],
      },
      data: { status: "PENDING_PAYMENT" },
    });
  } catch (error) {
    console.warn("[harbor] unpaid pickup backfill skipped", error);
  }
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

  async function safeTableColumns(table: TableName) {
    try {
      return await tableColumns(table);
    } catch {
      return new Set<string>();
    }
  }

  const columns: Record<TableName, Set<string>> = {
    User: await safeTableColumns("User"),
    Merchant: await safeTableColumns("Merchant"),
    MerchantApplication: await safeTableColumns("MerchantApplication"),
    SupportMessage: await safeTableColumns("SupportMessage"),
  };
  const needed: Array<[TableName, string, string]> = [
    ["User", "referralCode", `ALTER TABLE "User" ADD COLUMN "referralCode" TEXT`],
    ["User", "username", `ALTER TABLE "User" ADD COLUMN "username" TEXT`],
    ["User", "paymentPasswordHash", `ALTER TABLE "User" ADD COLUMN "paymentPasswordHash" TEXT`],
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
    const photos = await prisma.setting.findUnique({ where: { key: "distributionPhotosV7" } });
    if (!photos) {
      await syncDistributionCatalog(prisma);
      await prisma.setting.create({ data: { key: "distributionPhotosV7", value: "1" } });
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
    } else if (name.value === "Harbor Commerce" || name.value === "TikTok Shop") {
      await prisma.setting.update({ where: { key: "storeName" }, data: { value: BRAND_NAME } });
    }
  } catch (error) {
    console.warn("[harbor] storeName backfill skipped", error);
  }
  try {
    await prisma.user.updateMany({
      where: {
        OR: [{ email: "oscar.d@example.net" }, { role: "SUPER_ADMIN", name: "Amina Shah" }],
      },
      data: { name: SUPER_ADMIN_PUBLIC_NAME },
    });
  } catch (error) {
    console.warn("[harbor] super admin name backfill skipped", error);
  }
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET profit = ROUND(total - cost, 2) WHERE paidAt IS NULL`,
    );
  } catch (error) {
    console.warn("[harbor] order profit backfill skipped", error);
  }
  try {
    await pullRemotePersist();
  } catch (error) {
    console.warn("[harbor] remote persist pull skipped", error);
  }
  try {
    const restored = await restoreOpsUsers(prisma);
    if (restored > 0) console.log(`[harbor] Restored ${restored} Normal Backend users`);
    await snapshotOpsUsers(prisma);
  } catch (error) {
    console.warn("[harbor] ops user snapshot skipped", error);
  }
  try {
    const restoredStores = await restoreStores(prisma);
    if (restoredStores > 0) console.log(`[harbor] Restored ${restoredStores} stores`);
    await snapshotStores(prisma);
  } catch (error) {
    console.warn("[harbor] store snapshot skipped", error);
  }
}

async function peekAnyUser() {
  const prisma = getPrisma();
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "User" LIMIT 1`);
    if (rows?.[0]?.id) return true;
  } catch {
    /* fall through */
  }
  try {
    const user = await prisma.user.findFirst({ select: { id: true } });
    return Boolean(user);
  } catch {
    return false;
  }
}

function openSqlite(dest: string) {
  process.env.DATABASE_URL = `file:${dest}`;
  resetPrisma();
}

function scheduleBackfill() {
  if (backfillDone || backfillStarted) return;
  backfillStarted = true;
  void backfill()
    .then(() => {
      backfillDone = true;
    })
    .catch((error) => {
      console.warn("[harbor] background backfill skipped", error);
    })
    .finally(() => {
      backfillStarted = false;
    });
}

let dbReady = false;
let backfillStarted = false;
let backfillDone = false;

export async function ensureDatabase() {
  const root = repoRoot();
  applyRuntimeEnv(root);

  if (dbReady) {
    try {
      if (await peekAnyUser()) {
        scheduleBackfill();
        return;
      }
    } catch (error) {
      console.warn("[harbor] cached database probe failed", error);
    }
    dbReady = false;
  }

  const tried = new Set<string>();
  const queue: string[] = [];
  try {
    queue.push(resolveLiveSqlite(root));
  } catch (error) {
    console.warn("[harbor] resolveLiveSqlite skipped", error);
  }
  for (const file of existingSqliteFiles(root)) queue.push(file);

  for (const dest of queue) {
    if (!dest || tried.has(dest)) continue;
    tried.add(dest);
    try {
      openSqlite(dest);
      if (await peekAnyUser()) {
        dbReady = true;
        scheduleBackfill();
        return;
      }
    } catch (error) {
      console.warn("[harbor] SQLite candidate failed", dest, error);
    }
  }

  try {
    const restored = resolveLiveSqlite(root);
    openSqlite(restored);
    if (await peekAnyUser()) {
      dbReady = true;
      scheduleBackfill();
      return;
    }
  } catch (error) {
    console.warn("[harbor] packed SQLite restore failed", error);
  }

  throw new Error(`${BRAND_NAME} could not open a readable SQLite database with a login user.`);
}
