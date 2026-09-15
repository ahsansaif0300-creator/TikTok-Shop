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
