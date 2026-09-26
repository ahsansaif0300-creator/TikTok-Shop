#!/usr/bin/env node
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const dir = mkdtempSync(path.join(os.tmpdir(), "harbor-stores-stay-"));
const db = path.join(dir, "harbor-commerce.sqlite");
copyFileSync(path.join(root, "prisma", "demo.sqlite"), db);

process.env.HARBOR_USE_DEPLOY_DB = "1";
process.env.HARBOR_DATA_DIR = dir;
process.env.DATABASE_URL = `file:${db}`;

const { restoreStores, snapshotStores, readStoreSnapshots } = await import("../lib/stores-persist.ts");
const prisma = new PrismaClient({ datasources: { db: { url: `file:${db}` } } });

const CLIENT = [
  "ali-collections",
  "ak-shopping-store",
  "butt-store",
  "royal-lucky-store",
  "luqman-humi-store",
  "ola-here",
];

try {
  const before = await prisma.merchant.findMany({ select: { slug: true, name: true } });
  const missingBefore = CLIENT.filter((slug) => !before.some((row) => row.slug === slug));
  if (missingBefore.length) {
    await restoreStores(prisma);
  }

  const packed = await prisma.merchant.findMany({
    where: { slug: { in: CLIENT } },
    select: { id: true, slug: true },
  });
  if (packed.length < CLIENT.length) {
    throw new Error(`packed demo missing client stores: ${CLIENT.filter((slug) => !packed.some((row) => row.slug === slug)).join(",")}`);
  }

  await snapshotStores(prisma);
  const slugs = CLIENT.map((slug) => `'${slug}'`).join(",");
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Merchant" WHERE slug IN (${slugs})`);
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);

  const wiped = await prisma.merchant.findMany({ where: { slug: { in: CLIENT } } });
  if (wiped.length) throw new Error("wipe did not remove client stores");

  await snapshotStores(prisma);
  const stillSaved = CLIENT.filter((slug) => !readStoreSnapshots().some((store) => store.slug === slug));
  if (stillSaved.length) {
    throw new Error(`snapshot dropped stores after wipe: ${stillSaved.join(",")}`);
  }

  const restored = await restoreStores(prisma);
  const back = await prisma.merchant.findMany({
    where: { slug: { in: CLIENT } },
    select: { name: true, slug: true, status: true },
    orderBy: { name: "asc" },
  });
  if (back.length < CLIENT.length) {
    throw new Error(`restore missed stores: ${CLIENT.filter((slug) => !back.some((row) => row.slug === slug)).join(",")}`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      restored,
      stores: back.map((row) => row.name),
    }),
  );
} finally {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
}
