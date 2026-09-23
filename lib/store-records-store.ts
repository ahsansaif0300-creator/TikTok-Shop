import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { MerchantStatus, PrismaClient } from "@prisma/client";
import { storeRecordsSnapshotPaths } from "../scripts/copy-demo-db.mjs";

type StoreSnapshotUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  passwordHash: string;
  paymentPasswordHash: string | null;
  createdAt: string;
};

type StoreSnapshotApplication = {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  category: string;
  notes: string;
  status: string;
  reviewNote: string | null;
  referralCode: string;
  createdAt: string;
  reviewedAt: string | null;
};

type StoreSnapshotRecord = {
  id: string;
  name: string;
  slug: string;
  legalName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  status: MerchantStatus;
  planName: string;
  availableBalance: number;
  pendingBalance: number;
  rating: number;
  creditScore: number;
  reviewCount: number;
  bankName: string | null;
  bankAccountLast4: string | null;
  logo: string;
  cnicNumber: string;
  cnicImage: string;
  cnicImageFront: string;
  cnicImageBack: string;
  storeCode: string;
  referralCodeUsed: string;
  referredByEmail: string | null;
  createdAt: string;
  users: StoreSnapshotUser[];
  applications: StoreSnapshotApplication[];
};

type StoreSnapshot = {
  updatedAt: string;
  stores: StoreSnapshotRecord[];
};

function parseSnapshot(raw: string): StoreSnapshotRecord[] {
  try {
    const parsed = JSON.parse(raw) as StoreSnapshot;
    if (!Array.isArray(parsed?.stores)) return [];
    return parsed.stores.filter((store) => store?.slug && store?.name && store?.email);
  } catch {
    return [];
  }
}

function readSnapshots() {
  const bySlug = new Map<string, StoreSnapshotRecord>();
  for (const file of storeRecordsSnapshotPaths()) {
    try {
      if (!existsSync(file)) continue;
      for (const store of parseSnapshot(readFileSync(file, "utf8"))) {
        const slug = store.slug.trim().toLowerCase();
        if (!slug) continue;
        const current = bySlug.get(slug);
        if (!current || (store.createdAt || "") >= (current.createdAt || "")) {
          bySlug.set(slug, { ...store, slug });
        }
      }
    } catch (error) {
      console.warn("[harbor] store records snapshot read skipped", file, error);
    }
  }
  return [...bySlug.values()];
}

function writeSnapshots(stores: StoreSnapshotRecord[]) {
  const payload: StoreSnapshot = {
    updatedAt: new Date().toISOString(),
    stores: stores.sort((a, b) => a.name.localeCompare(b.name)),
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  for (const file of storeRecordsSnapshotPaths()) {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, body);
    } catch (error) {
      console.warn("[harbor] store records snapshot write skipped", file, error);
    }
  }
}

function mergeStores(fromFile: StoreSnapshotRecord[], fromDb: StoreSnapshotRecord[]) {
  const merged = new Map<string, StoreSnapshotRecord>();
  for (const store of fromFile) merged.set(store.slug.trim().toLowerCase(), store);
  for (const store of fromDb) merged.set(store.slug.trim().toLowerCase(), store);
  return [...merged.values()];
}

export async function snapshotStoreRecords(prisma: PrismaClient) {
  const merchants = await prisma.merchant.findMany({
    include: {
      plan: { select: { name: true } },
      referredBy: { select: { email: true } },
      users: {
        where: { role: "MERCHANT" },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          passwordHash: true,
          paymentPasswordHash: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      applications: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const fromDb: StoreSnapshotRecord[] = merchants
    .filter((merchant) => !merchant.slug.startsWith("verify-"))
    .map((merchant) => ({
    id: merchant.id,
    name: merchant.name,
    slug: merchant.slug,
    legalName: merchant.legalName,
    email: merchant.email,
    phone: merchant.phone,
    country: merchant.country,
    city: merchant.city,
    address: merchant.address,
    status: merchant.status,
    planName: merchant.plan.name,
    availableBalance: merchant.availableBalance,
    pendingBalance: merchant.pendingBalance,
    rating: merchant.rating,
    creditScore: merchant.creditScore,
    reviewCount: merchant.reviewCount,
    bankName: merchant.bankName,
    bankAccountLast4: merchant.bankAccountLast4,
    logo: merchant.logo,
    cnicNumber: merchant.cnicNumber,
    cnicImage: merchant.cnicImage,
    cnicImageFront: merchant.cnicImageFront,
    cnicImageBack: merchant.cnicImageBack,
    storeCode: merchant.storeCode,
    referralCodeUsed: merchant.referralCodeUsed,
    referredByEmail: merchant.referredBy?.email ?? null,
    createdAt: merchant.createdAt.toISOString(),
    users: merchant.users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      passwordHash: user.passwordHash,
      paymentPasswordHash: user.paymentPasswordHash,
      createdAt: user.createdAt.toISOString(),
    })),
    applications: merchant.applications.map((application) => ({
      id: application.id,
      businessName: application.businessName,
      contactName: application.contactName,
      email: application.email,
      phone: application.phone,
      country: application.country,
      category: application.category,
      notes: application.notes,
      status: application.status,
      reviewNote: application.reviewNote,
      referralCode: application.referralCode,
      createdAt: application.createdAt.toISOString(),
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
    })),
  }));
  writeSnapshots(mergeStores(readSnapshots(), fromDb));
}

export async function restoreStoreRecords(prisma: PrismaClient) {
  const saved = readSnapshots();
  if (saved.length === 0) return 0;

  const plans = await prisma.plan.findMany({ select: { id: true, name: true, monthlyFee: true } });
  const fallbackPlan = plans.sort((a, b) => a.monthlyFee - b.monthlyFee)[0];
  if (!fallbackPlan) return 0;

  let restored = 0;
  for (const row of saved) {
    const slug = row.slug.trim().toLowerCase();
    const email = row.email.trim().toLowerCase();
    const existing = await prisma.merchant.findFirst({
      where: { OR: [{ slug }, { id: row.id }, ...(email ? [{ email }] : [])] },
      select: { id: true },
    });
    if (existing) {
      await restoreMerchantUsers(prisma, existing.id, row.users);
      continue;
    }

    const plan = plans.find((item) => item.name === row.planName) ?? fallbackPlan;
    let referredByUserId: string | null = null;
    if (row.referredByEmail) {
      const referrer = await prisma.user.findUnique({
        where: { email: row.referredByEmail.trim().toLowerCase() },
        select: { id: true },
      });
      referredByUserId = referrer?.id ?? null;
    }

    const status: MerchantStatus =
      row.status === "ACTIVE" || row.status === "SUSPENDED" || row.status === "PENDING"
        ? row.status
        : "PENDING";

    try {
      await prisma.merchant.create({
        data: {
          id: row.id,
          name: row.name,
          slug,
          legalName: row.legalName || row.name,
          email,
          phone: row.phone || "",
          country: row.country || "",
          city: row.city || "",
          address: row.address || "",
          status,
          planId: plan.id,
          availableBalance: row.availableBalance ?? 0,
          pendingBalance: row.pendingBalance ?? 0,
          rating: row.rating ?? 5,
          creditScore: row.creditScore ?? 100,
          reviewCount: row.reviewCount ?? 0,
          bankName: row.bankName,
          bankAccountLast4: row.bankAccountLast4,
          logo: row.logo || "",
          cnicNumber: row.cnicNumber || "",
          cnicImage: row.cnicImage || "",
          cnicImageFront: row.cnicImageFront || "",
          cnicImageBack: row.cnicImageBack || "",
          storeCode: row.storeCode || "",
          referralCodeUsed: row.referralCodeUsed || "",
          referredByUserId,
          createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        },
      });
      restored += 1;
    } catch (error) {
      console.warn("[harbor] store record restore skipped", slug, error);
      continue;
    }

    await restoreMerchantUsers(prisma, row.id, row.users);
    for (const application of row.applications || []) {
      const applicationId = application.id;
      const already = await prisma.merchantApplication.findUnique({
        where: { id: applicationId },
        select: { id: true },
      });
      if (already) continue;
      try {
        await prisma.merchantApplication.create({
          data: {
            id: applicationId,
            businessName: application.businessName,
            contactName: application.contactName,
            email: application.email,
            phone: application.phone,
            country: application.country,
            category: application.category,
            notes: application.notes,
            status:
              application.status === "APPROVED" || application.status === "REJECTED"
                ? application.status
                : "PENDING",
            reviewNote: application.reviewNote,
            merchantId: row.id,
            referralCode: application.referralCode || "",
            createdAt: application.createdAt ? new Date(application.createdAt) : undefined,
            reviewedAt: application.reviewedAt ? new Date(application.reviewedAt) : undefined,
          },
        });
      } catch (error) {
        console.warn("[harbor] store application restore skipped", application.email, error);
      }
    }
  }
  return restored;
}

async function restoreMerchantUsers(prisma: PrismaClient, merchantId: string, users: StoreSnapshotUser[]) {
  for (const row of users || []) {
    const email = row.email.trim().toLowerCase();
    const username = row.username?.trim().toLowerCase() || null;
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { id: row.id }, ...(username ? [{ username }] : [])],
      },
      select: { id: true, merchantId: true, role: true },
    });
    if (existing) {
      if (existing.role === "MERCHANT" && !existing.merchantId) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { merchantId },
        });
      }
      continue;
    }
    try {
      await prisma.user.create({
        data: {
          id: row.id,
          email,
          username,
          name: row.name,
          passwordHash: row.passwordHash,
          paymentPasswordHash: row.paymentPasswordHash,
          role: "MERCHANT",
          merchantId,
          createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        },
      });
    } catch (error) {
      console.warn("[harbor] store login restore skipped", email, error);
    }
  }
}
