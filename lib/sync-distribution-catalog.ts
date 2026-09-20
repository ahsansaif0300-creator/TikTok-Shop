import type { PrismaClient, ProductListingStatus, ProductStatus } from "@prisma/client";
import {
  GROWTH_MAX_PRODUCTS,
  ON_SHELF_TITLES,
  pricedDistributionCatalog,
  pricedExtraProducts,
} from "@/lib/distribution-catalog";
import { STORE_CATEGORIES, categorySlug } from "@/lib/store-categories";

export async function ensureCatalogCategories(prisma: PrismaClient) {
  const categories = [];
  for (const name of STORE_CATEGORIES) {
    const slug = categorySlug(name);
    categories.push(
      await prisma.category.upsert({
        where: { slug },
        create: { name, slug },
        update: { name },
      }),
    );
  }
  return Object.fromEntries(categories.map((category) => [category.name, category]));
}

export async function bumpGrowthCatalogCap(prisma: PrismaClient) {
  await prisma.plan.updateMany({
    where: { name: "Growth", maxProducts: { lt: GROWTH_MAX_PRODUCTS } },
    data: { maxProducts: GROWTH_MAX_PRODUCTS },
  });
}

export async function syncDistributionCatalog(
  prisma: PrismaClient,
  options: { overwriteListing?: boolean } = {},
) {
  const categoryByName = await ensureCatalogCategories(prisma);
  await bumpGrowthCatalogCap(prisma);

  const northline = await prisma.merchant.findUnique({ where: { slug: "northline-outfitters" } });
  if (!northline) return;

  const extraMerchants = await prisma.merchant.findMany({
    where: {
      slug: {
        in: [
          "northline-outfitters",
          "cedar-co-home",
          "lumen-beauty",
          "atlas-fitness",
          "willow-baby",
          "brightbyte-electronics",
        ],
      },
    },
  });
  const bySlug: Record<string, (typeof extraMerchants)[number]> = Object.fromEntries(
    extraMerchants.map((merchant) => [merchant.slug, merchant]),
  );
  const byIndex = [
    bySlug["northline-outfitters"] ?? northline,
    bySlug["cedar-co-home"],
    bySlug["lumen-beauty"],
    bySlug["atlas-fitness"],
    bySlug["willow-baby"],
    bySlug["brightbyte-electronics"],
  ];

  for (const row of pricedDistributionCatalog()) {
    const category = categoryByName[row.category];
    if (!category) throw new Error(`Unknown category ${row.category}`);
    const listingStatus: ProductListingStatus = ON_SHELF_TITLES.has(row.title) ? "ON_SHELF" : "LISTED";
    const data = {
      merchantId: northline.id,
      categoryId: category.id,
      title: row.title,
      description: row.description,
      price: row.price,
      cost: row.cost,
      stock: 28 + (row.sku.length * 7) % 90,
      status: "ACTIVE" as ProductStatus,
      image: row.image,
    };
    await prisma.product.upsert({
      where: { sku: row.sku },
      create: { ...data, sku: row.sku, listingStatus },
      update: options.overwriteListing ? { ...data, listingStatus } : data,
    });
  }

  for (const row of pricedExtraProducts()) {
    const merchant = byIndex[row.merchant];
    const category = categoryByName[row.category];
    if (!merchant || !category) continue;
    const listingStatus: ProductListingStatus = merchant.status === "SUSPENDED" ? "ON_SHELF" : "LISTED";
    const status: ProductStatus = merchant.status === "SUSPENDED" ? "ARCHIVED" : "ACTIVE";
    const data = {
      merchantId: merchant.id,
      categoryId: category.id,
      title: row.title,
      description: row.description,
      price: row.price,
      cost: row.cost,
      stock: 18 + row.merchant * 4,
      status,
      image: row.image,
    };
    await prisma.product.upsert({
      where: { sku: row.sku },
      create: { ...data, sku: row.sku, listingStatus },
      update: options.overwriteListing ? { ...data, listingStatus } : data,
    });
  }
}

const CATALOG_INSERT_BATCH = 40;

export async function cloneDistributionCatalogForMerchant(prisma: PrismaClient, merchantId: string) {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, storeCode: true },
    });
    if (!merchant) return 0;

    const existing = await prisma.product.count({ where: { merchantId } });
    if (existing > 0) return existing;

    const categoryByName = await ensureCatalogCategories(prisma);
    const suffix = (merchant.storeCode || merchant.id).replace(/[^A-Za-z0-9]/g, "").slice(-12) || merchant.id.slice(-8);
    const rows = [];
    for (const row of pricedDistributionCatalog()) {
      const category = categoryByName[row.category];
      if (!category) continue;
      const listingStatus: ProductListingStatus = ON_SHELF_TITLES.has(row.title) ? "ON_SHELF" : "LISTED";
      rows.push({
        merchantId,
        categoryId: category.id,
        title: row.title,
        sku: `${row.sku}-${suffix}`,
        description: row.description,
        price: row.price,
        cost: row.cost,
        stock: 28 + (row.sku.length * 7) % 90,
        status: "ACTIVE" as ProductStatus,
        listingStatus,
        image: row.image,
      });
    }

    for (let index = 0; index < rows.length; index += CATALOG_INSERT_BATCH) {
      try {
        await prisma.product.createMany({
          data: rows.slice(index, index + CATALOG_INSERT_BATCH),
          skipDuplicates: true,
        });
      } catch (error) {
        console.error("[harbor] catalog clone batch failed", merchantId, index, error);
      }
    }
    return prisma.product.count({ where: { merchantId } });
  } catch (error) {
    console.error("[harbor] catalog clone failed", merchantId, error);
    return 0;
  }
}

export async function ensureMerchantCatalog(prisma: PrismaClient, merchantId: string | null | undefined) {
  if (!merchantId) return 0;
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, status: true },
    });
    if (!merchant || merchant.status !== "ACTIVE") return 0;
    return await cloneDistributionCatalogForMerchant(prisma, merchant.id);
  } catch (error) {
    console.error("[harbor] ensureMerchantCatalog failed", merchantId, error);
    return 0;
  }
}
