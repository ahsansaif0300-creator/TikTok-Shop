import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  preserveLiveSqlite,
  storeRecordsReadPaths,
  storeRecordsSnapshotPaths,
} from "../scripts/copy-demo-db.mjs";
import { ensureMerchantCatalog } from "@/lib/sync-distribution-catalog";
import { queueRemotePush, REMOTE_STORES_PATH } from "@/lib/remote-persist";

type StoreUserSnap = {
  email: string;
  username: string | null;
  name: string;
  passwordHash: string;
  paymentPasswordHash: string | null;
  role: "MERCHANT";
  createdAt: string;
};

type StoreAppSnap = {
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
};

type StoreSnap = {
  name: string;
  slug: string;
  legalName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  status: string;
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
  createdAt: string;
  users: StoreUserSnap[];
  applications: StoreAppSnap[];
};

type StoreSnapshot = {
  updatedAt: string;
  stores: StoreSnap[];
  deletedSlugs?: string[];
  orphanApplications?: StoreAppSnap[];
};

function parseSnapshot(raw: string): StoreSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as StoreSnapshot;
    if (!Array.isArray(parsed?.stores)) return null;
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      stores: parsed.stores.filter((store) => store?.slug && store?.name),
      deletedSlugs: (parsed.deletedSlugs ?? []).map((slug) => String(slug || "").trim()).filter(Boolean),
      orphanApplications: (parsed.orphanApplications ?? []).filter((row) => row?.businessName && row?.email),
    };
  } catch {
    return null;
  }
}

function readSnapshotBundle(): StoreSnapshot {
  const bySlug = new Map<string, StoreSnap>();
  const deleted = new Set<string>();
  const orphans = new Map<string, StoreAppSnap>();
  for (const file of storeRecordsReadPaths()) {
    try {
      if (!existsSync(file)) continue;
      const parsed = parseSnapshot(readFileSync(file, "utf8"));
      if (!parsed) continue;
      for (const slug of parsed.deletedSlugs ?? []) deleted.add(slug);
      for (const store of parsed.stores) {
        bySlug.set(store.slug, store);
      }
      for (const application of parsed.orphanApplications ?? []) {
        orphans.set(`${application.email}::${application.businessName}`, application);
      }
    } catch (error) {
      console.warn("[harbor] store snapshot read skipped", file, error);
    }
  }
  for (const slug of deleted) bySlug.delete(slug);
  return {
    updatedAt: new Date().toISOString(),
    stores: [...bySlug.values()],
    deletedSlugs: [...deleted],
    orphanApplications: [...orphans.values()],
  };
}

export function readStoreSnapshots() {
  return readSnapshotBundle().stores;
}

function readSnapshots() {
  return readSnapshotBundle().stores;
}

function snapApplication(application: {
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
  createdAt: Date | string;
}): StoreAppSnap {
  return {
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
    createdAt:
      application.createdAt instanceof Date
        ? application.createdAt.toISOString()
        : application.createdAt,
  };
}

function keepUntilAdminRemoves(
  previous: StoreSnapshot,
  liveStores: StoreSnap[],
  liveOrphans: StoreAppSnap[],
  extra?: { deletedSlug?: string },
): StoreSnapshot {
  const liveSlugs = new Set(liveStores.map((store) => store.slug));
  const deleted = new Set((previous.deletedSlugs ?? []).filter((slug) => !liveSlugs.has(slug)));
  const extraSlug = extra?.deletedSlug?.trim();
  if (extraSlug && !liveSlugs.has(extraSlug)) deleted.add(extraSlug);

  const bySlug = new Map<string, StoreSnap>();
  for (const store of previous.stores) {
    if (!deleted.has(store.slug)) bySlug.set(store.slug, store);
  }
  for (const store of liveStores) {
    bySlug.set(store.slug, store);
  }
  for (const slug of deleted) bySlug.delete(slug);

  const orphans = new Map<string, StoreAppSnap>();
  for (const application of previous.orphanApplications ?? []) {
    orphans.set(`${application.email}::${application.businessName}`, application);
  }
  for (const application of liveOrphans) {
    orphans.set(`${application.email}::${application.businessName}`, application);
  }

  return {
    updatedAt: new Date().toISOString(),
    stores: [...bySlug.values()],
    deletedSlugs: [...deleted],
    orphanApplications: [...orphans.values()],
  };
}

export async function snapshotStores(prisma: PrismaClient, extra?: { deletedSlug?: string }) {
  const merchants = await prisma.merchant.findMany({
    include: {
      plan: { select: { name: true } },
      users: {
        where: { role: "MERCHANT" },
        select: {
          email: true,
          username: true,
          name: true,
          passwordHash: true,
          paymentPasswordHash: true,
          createdAt: true,
        },
      },
      applications: {
        select: {
          businessName: true,
          contactName: true,
          email: true,
          phone: true,
          country: true,
          category: true,
          notes: true,
          status: true,
          reviewNote: true,
          referralCode: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const previous = readSnapshotBundle();
  const orphanApplications = await prisma.merchantApplication.findMany({
    where: { merchantId: null },
    select: {
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      country: true,
      category: true,
      notes: true,
      status: true,
      reviewNote: true,
      referralCode: true,
      createdAt: true,
    },
  });
  const liveStores: StoreSnap[] = merchants.map((merchant) => ({
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
    createdAt: merchant.createdAt.toISOString(),
    users: merchant.users.map((user) => ({
      email: user.email,
      username: user.username,
      name: user.name,
      passwordHash: user.passwordHash,
      paymentPasswordHash: user.paymentPasswordHash,
      role: "MERCHANT" as const,
      createdAt: user.createdAt.toISOString(),
    })),
    applications: merchant.applications.map((application) => snapApplication(application)),
  }));
  const payload = keepUntilAdminRemoves(
    previous,
    liveStores,
    orphanApplications.map((application) => snapApplication(application)),
    extra,
  );
  const body = `${JSON.stringify(payload)}\n`;
  for (const file of storeRecordsSnapshotPaths()) {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, body);
    } catch (error) {
      console.warn("[harbor] store snapshot write skipped", file, error);
    }
  }
  queueRemotePush(REMOTE_STORES_PATH, body);
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("file:")) {
    try {
      preserveLiveSqlite(url.slice("file:".length));
    } catch (error) {
      console.warn("[harbor] live sqlite preserve skipped", error);
    }
  }
}

async function restoreStoreUsers(
  prisma: PrismaClient,
  merchantId: string,
  users: StoreUserSnap[] | undefined,
) {
  let restored = 0;
  for (const user of users ?? []) {
    const email = user.email.trim().toLowerCase();
    if (!email) continue;
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true, merchantId: true } });
    if (taken) {
      if (!taken.merchantId) {
        await prisma.user.update({ where: { id: taken.id }, data: { merchantId } });
        restored += 1;
      }
      continue;
    }
    await prisma.user.create({
      data: {
        email,
        username: user.username,
        name: user.name,
        passwordHash: user.passwordHash,
        paymentPasswordHash: user.paymentPasswordHash,
        role: "MERCHANT",
        merchantId,
        createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
      },
    });
    restored += 1;
  }
  return restored;
}

async function restoreStoreApplications(
  prisma: PrismaClient,
  merchantId: string | null,
  applications: StoreAppSnap[] | undefined,
) {
  let restored = 0;
  for (const application of applications ?? []) {
    const email = application.email.trim().toLowerCase();
    const existing = await prisma.merchantApplication.findFirst({
      where: { email, businessName: application.businessName, merchantId },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.merchantApplication.create({
      data: {
        businessName: application.businessName,
        contactName: application.contactName,
        email: application.email,
        phone: application.phone,
        country: application.country,
        category: application.category || "Public signup",
        notes: application.notes || "",
        status:
          application.status === "APPROVED"
            ? "APPROVED"
            : application.status === "REJECTED"
              ? "REJECTED"
              : "PENDING",
        reviewNote: application.reviewNote,
        merchantId,
        referralCode: application.referralCode || "",
        createdAt: application.createdAt ? new Date(application.createdAt) : undefined,
      },
    });
    restored += 1;
  }
  return restored;
}

export async function restoreStores(prisma: PrismaClient) {
  const bundle = readSnapshotBundle();
  const saved = bundle.stores;
  if (saved.length === 0 && (bundle.orphanApplications?.length ?? 0) === 0) return 0;
  const plans = await prisma.plan.findMany();
  const cheapest = plans.sort((a, b) => a.monthlyFee - b.monthlyFee)[0];
  if (!cheapest) return 0;

  let restored = 0;
  restored += await restoreStoreApplications(prisma, null, bundle.orphanApplications);
  for (const row of saved) {
    const existing = await prisma.merchant.findUnique({
      where: { slug: row.slug },
      select: {
        id: true,
        status: true,
        phone: true,
        city: true,
        country: true,
        email: true,
        cnicNumber: true,
        cnicImageFront: true,
        cnicImageBack: true,
        referralCodeUsed: true,
        storeCode: true,
        availableBalance: true,
        pendingBalance: true,
      },
    });
    if (existing) {
      const patch: {
        phone?: string;
        city?: string;
        email?: string;
        cnicNumber?: string;
        cnicImage?: string;
        cnicImageFront?: string;
        cnicImageBack?: string;
        referralCodeUsed?: string;
        storeCode?: string;
        availableBalance?: number;
        pendingBalance?: number;
        status?: "ACTIVE" | "PENDING" | "SUSPENDED";
      } = {};
      if (!existing.phone && row.phone) patch.phone = row.phone;
      if ((!existing.city || existing.city === existing.country) && row.city) patch.city = row.city;
      if (row.email && existing.email !== row.email && !existing.email.includes("@gmail.com")) {
        patch.email = row.email;
      }
      if (!existing.cnicNumber && row.cnicNumber) patch.cnicNumber = row.cnicNumber;
      if (!existing.cnicImageFront && row.cnicImageFront) {
        patch.cnicImageFront = row.cnicImageFront;
        patch.cnicImage = row.cnicImage || row.cnicImageFront;
      }
      if (!existing.cnicImageBack && row.cnicImageBack) patch.cnicImageBack = row.cnicImageBack;
      if (!existing.referralCodeUsed && row.referralCodeUsed) patch.referralCodeUsed = row.referralCodeUsed;
      if (!existing.storeCode && row.storeCode) patch.storeCode = row.storeCode;
      // Fill recovered funds only when the live row is empty. Never increment on every boot.
      if ((existing.availableBalance ?? 0) <= 0 && (row.availableBalance ?? 0) > 0) {
        patch.availableBalance = row.availableBalance;
      }
      if ((existing.pendingBalance ?? 0) <= 0 && (row.pendingBalance ?? 0) > 0) {
        patch.pendingBalance = row.pendingBalance;
      }
      if (existing.status === "PENDING" && row.status === "ACTIVE") patch.status = "ACTIVE";
      if (Object.keys(patch).length > 0) {
        await prisma.merchant.update({ where: { id: existing.id }, data: patch });
        restored += 1;
      }
      restored += await restoreStoreUsers(prisma, existing.id, row.users);
      restored += await restoreStoreApplications(prisma, existing.id, row.applications);
      continue;
    }

    const plan = plans.find((item) => item.name === row.planName) ?? cheapest;
    const merchant = await prisma.merchant.create({
      data: {
        name: row.name,
        slug: row.slug,
        legalName: row.legalName || row.name,
        email: row.email,
        phone: row.phone,
        country: row.country,
        city: row.city || row.country,
        address: row.address || "Address pending",
        status: row.status === "SUSPENDED" ? "SUSPENDED" : row.status === "ACTIVE" ? "ACTIVE" : "PENDING",
        planId: plan.id,
        availableBalance: row.availableBalance ?? 0,
        pendingBalance: row.pendingBalance ?? 0,
        rating: row.rating ?? 5,
        creditScore: row.creditScore ?? 100,
        reviewCount: row.reviewCount ?? 0,
        bankName: row.bankName,
        bankAccountLast4: row.bankAccountLast4,
        logo: row.logo ?? "",
        cnicNumber: row.cnicNumber ?? "",
        cnicImage: row.cnicImage ?? "",
        cnicImageFront: row.cnicImageFront ?? "",
        cnicImageBack: row.cnicImageBack ?? "",
        storeCode: row.storeCode ?? "",
        referralCodeUsed: row.referralCodeUsed ?? "",
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
      },
    });
    restored += 1;
    restored += await restoreStoreUsers(prisma, merchant.id, row.users);
    restored += await restoreStoreApplications(prisma, merchant.id, row.applications);

    const products = await prisma.product.count({ where: { merchantId: merchant.id } });
    if (products === 0 && merchant.status === "ACTIVE") {
      try {
        await ensureMerchantCatalog(prisma, merchant.id);
      } catch (error) {
        console.warn("[harbor] catalog restore skipped", merchant.slug, error);
      }
    }
  }
  return restored;
}
