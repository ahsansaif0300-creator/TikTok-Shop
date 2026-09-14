import { installDemoDb } from "../scripts/copy-demo-db.mjs";
import { applyRuntimeEnv } from "./runtime-env";
import { getPrisma, resetPrisma } from "./db";
import { STORE_CATEGORIES, categorySlug } from "./store-categories";
import { backfillStoreCodes } from "./store-code";
import { ensureOpsReferralCodes } from "./referral";

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
  for (const sql of [
    `ALTER TABLE "User" ADD COLUMN "referralCode" TEXT`,
    `ALTER TABLE "Merchant" ADD COLUMN "cnicImageFront" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Merchant" ADD COLUMN "cnicImageBack" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Merchant" ADD COLUMN "referralCodeUsed" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Merchant" ADD COLUMN "referredByUserId" TEXT`,
    `ALTER TABLE "MerchantApplication" ADD COLUMN "referredByUserId" TEXT`,
    `ALTER TABLE "MerchantApplication" ADD COLUMN "referralCode" TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // Column already exists on upgraded databases.
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
