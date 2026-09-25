import { writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { restoreStores, snapshotStores } from "../lib/stores-persist";
import { packedRecoveredStoresPath } from "./copy-demo-db.mjs";

const CLIENT_STORES = [
  {
    name: "Butt store",
    slug: "butt-store",
    email: "leo.a@example.org",
    storeCode: "STORE101",
    contactName: "Butt Store",
  },
  {
    name: "Royal Lucky store",
    slug: "royal-lucky-store",
    email: "yosef.c@example.com",
    storeCode: "STORE102",
    contactName: "Royal Lucky",
  },
  {
    name: "Luqman humi store",
    slug: "luqman-humi-store",
    email: "kevin.m@example.com",
    storeCode: "STORE103",
    contactName: "Luqman Humi",
  },
  {
    name: "Ola here",
    slug: "ola-here",
    email: "james.b@example.com",
    storeCode: "STORE104",
    contactName: "Ola Here",
  },
];

const now = new Date().toISOString();

async function main() {
  const passwordHash = await bcrypt.hash("HarborMerchant!2026", 10);
  const packed = packedRecoveredStoresPath();
  const current = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(packed, "utf8")));
  const bySlug = new Map((current.stores || []).map((store: { slug: string }) => [store.slug, store]));
  for (const store of CLIENT_STORES) {
    bySlug.set(store.slug, {
      name: store.name,
      slug: store.slug,
      legalName: store.name,
      email: store.email,
      phone: "",
      country: "Pakistan",
      city: "Pakistan",
      address: "Address pending",
      status: "ACTIVE",
      planName: "Starter",
      availableBalance: 0,
      pendingBalance: 0,
      rating: 5,
      creditScore: 100,
      reviewCount: 0,
      bankName: null,
      bankAccountLast4: null,
      logo: "",
      cnicNumber: "",
      cnicImage: "",
      cnicImageFront: "",
      cnicImageBack: "",
      storeCode: store.storeCode,
      referralCodeUsed: "",
      createdAt: now,
      users: [
        {
          email: store.email,
          username: null,
          name: store.contactName,
          passwordHash,
          paymentPasswordHash: passwordHash,
          role: "MERCHANT",
          createdAt: now,
        },
      ],
      applications: [
        {
          businessName: store.name,
          contactName: store.contactName,
          email: store.email,
          phone: "",
          country: "Pakistan",
          category: "Public signup",
          notes: "Client-requested store recovery",
          status: "APPROVED",
          reviewNote: "Restored by request",
          referralCode: "",
          createdAt: now,
        },
      ],
    });
  }
  const payload = {
    updatedAt: now,
    stores: [...bySlug.values()].sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)),
  };
  writeFileSync(packed, `${JSON.stringify(payload)}\n`);

  const demo = path.join(path.resolve(import.meta.dirname, ".."), "prisma", "demo.sqlite");
  process.env.HARBOR_USE_DEPLOY_DB = "1";
  process.env.DATABASE_URL = `file:${demo}`;
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${demo}` } } });
  try {
    const restored = await restoreStores(prisma);
    await snapshotStores(prisma);
    const names = await prisma.merchant.findMany({
      where: { slug: { in: CLIENT_STORES.map((store) => store.slug) } },
      select: { name: true, slug: true, email: true, status: true },
      orderBy: { name: "asc" },
    });
    console.log(JSON.stringify({ packed: payload.stores.length, restored, names }, null, 2));
    if (names.length < 4) throw new Error("packed demo is missing client stores");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
