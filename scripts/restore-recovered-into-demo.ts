import { copyFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { restoreStores, snapshotStores } from "../lib/stores-persist";

const root = path.resolve(import.meta.dirname, "..");
const demo = path.join(root, "prisma", "demo.sqlite");
const dest = path.join(root, "prisma", "demo.sqlite");

process.env.HARBOR_USE_DEPLOY_DB = "1";
process.env.DATABASE_URL = `file:${dest}`;

const prisma = new PrismaClient({ datasources: { db: { url: `file:${dest}` } } });

async function main() {
  void copyFileSync;
  const before = await prisma.merchant.count();
  const restored = await restoreStores(prisma);
  const after = await prisma.merchant.count();
  await snapshotStores(prisma);
  const names = (await prisma.merchant.findMany({ select: { name: true, slug: true, status: true }, orderBy: { name: "asc" } }))
    .map((row) => `${row.name} (${row.slug}/${row.status})`);
  console.log(JSON.stringify({ before, restored, after, names }, null, 2));
  if (after < 17) throw new Error(`demo.sqlite should have 17 stores after recovery, found ${after}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
