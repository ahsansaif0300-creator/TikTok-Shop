#!/usr/bin/env node
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const dir = mkdtempSync(path.join(os.tmpdir(), "harbor-store-persist-"));
const db = path.join(dir, "harbor-commerce.sqlite");
copyFileSync(path.join(root, "prisma", "demo.sqlite"), db);

process.env.HARBOR_USE_DEPLOY_DB = "1";
process.env.HARBOR_DATA_DIR = dir;
process.env.DATABASE_URL = `file:${db}`;

const { snapshotStores, restoreStores, readStoreSnapshots } = await import("../lib/stores-persist.ts");

const prisma = new PrismaClient({ datasources: { db: { url: `file:${db}` } } });

try {
  const stamp = Date.now();
  const slug = `keep-forever-store-${stamp}`;
  const email = `keep.forever.${stamp}@example.test`;
  const plan = await prisma.plan.findFirst({ orderBy: { monthlyFee: "asc" } });
  if (!plan) throw new Error("demo plan missing");

  await prisma.merchant.create({
    data: {
      name: "Keep Forever Store",
      slug,
      legalName: "Keep Forever Store",
      email,
      phone: "",
      country: "Pakistan",
      city: "Pakistan",
      address: "Address pending",
      status: "ACTIVE",
      planId: plan.id,
      storeCode: "STORE199",
    },
  });
  await prisma.user.create({
    data: {
      name: "Keep Forever",
      email,
      passwordHash: bcrypt.hashSync("KeepForever!2026", 8),
      paymentPasswordHash: bcrypt.hashSync("KeepForever!2026", 8),
      role: "MERCHANT",
      merchant: { connect: { slug } },
    },
  });

  await snapshotStores(prisma);
  if (!readStoreSnapshots().some((store) => store.slug === slug)) {
    throw new Error("created store was not snapshotted");
  }

  await prisma.user.deleteMany({ where: { email } });
  await prisma.merchantApplication.deleteMany({ where: { email } });
  await prisma.merchant.delete({ where: { slug } });
  if (await prisma.merchant.findUnique({ where: { slug } })) {
    throw new Error("wipe did not remove the store");
  }

  await snapshotStores(prisma);
  if (!readStoreSnapshots().some((store) => store.slug === slug)) {
    throw new Error("automatic wipe dropped the store from the keep-forever snapshot");
  }

  const restored = await restoreStores(prisma);
  const store = await prisma.merchant.findUnique({
    where: { slug },
    include: { users: true },
  });
  if (restored < 1 || !store) throw new Error("restore did not bring the store back");
  if (!store.users.some((user) => user.email === email)) {
    throw new Error("restored store is missing its login");
  }

  const merchants = await prisma.merchant.findMany({ orderBy: { name: "asc" } });
  if (!merchants.some((row) => row.slug === slug && row.name === "Keep Forever Store")) {
    throw new Error("Merchants list is missing the restored store");
  }
  if (!merchants.some((row) => row.slug === "northline-outfitters")) {
    throw new Error("Merchants list dropped an existing store");
  }

  await prisma.user.deleteMany({ where: { email } });
  await prisma.merchantApplication.deleteMany({ where: { email } });
  await prisma.merchant.delete({ where: { slug } });
  await snapshotStores(prisma, { deletedSlug: slug });
  await restoreStores(prisma);
  if (await prisma.merchant.findUnique({ where: { slug } })) {
    throw new Error("admin-deleted store came back after restore");
  }
  if (readStoreSnapshots().some((store) => store.slug === slug)) {
    throw new Error("admin-deleted store remained in the snapshot");
  }

  console.log(
    JSON.stringify({
      ok: true,
      restored,
      merchants: merchants.length,
      names: merchants.map((row) => row.name),
    }),
  );
} finally {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
}
