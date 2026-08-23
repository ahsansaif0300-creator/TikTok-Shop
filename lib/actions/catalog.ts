"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { canAccessMerchant, catalogMerchantId } from "@/lib/scope";

const PRODUCT_STATUSES: ProductStatus[] = ["ACTIVE", "DRAFT", "ARCHIVED"];

function fail(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

export async function saveProduct(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const merchantId = catalogMerchantId(session, String(formData.get("merchantId") ?? ""));
  const returnPath = id ? `/products/${id}` : "/products/new";
  if (!merchantId || !canAccessMerchant(session, merchantId)) {
    fail(returnPath, "forbidden");
  }

  const statusRaw = String(formData.get("status") ?? "ACTIVE") as ProductStatus;
  const data = {
    merchantId,
    categoryId: String(formData.get("categoryId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    sku: String(formData.get("sku") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    price: Number(formData.get("price") ?? 0),
    cost: Number(formData.get("cost") ?? 0),
    stock: Number(formData.get("stock") ?? 0),
    status: PRODUCT_STATUSES.includes(statusRaw) ? statusRaw : "DRAFT",
  };
  if (!data.title || !data.sku || !data.categoryId) fail(returnPath, "invalid");
  if (!Number.isFinite(data.price) || data.price < 0) fail(returnPath, "invalid");
  if (!Number.isFinite(data.cost) || data.cost < 0) fail(returnPath, "invalid");
  if (!Number.isFinite(data.stock) || data.stock < 0) fail(returnPath, "invalid");
  data.stock = Math.floor(data.stock);

  const skuOwner = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (skuOwner && skuOwner.id !== id) fail(returnPath, "sku");

  if (id) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || !canAccessMerchant(session, existing.merchantId)) fail(returnPath, "forbidden");
    await prisma.product.update({ where: { id }, data });
  } else {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { plan: true, _count: { select: { products: true } } },
    });
    if (!merchant) fail(returnPath, "forbidden");
    if (merchant._count.products >= merchant.plan.maxProducts) fail(returnPath, "cap");
    await prisma.product.create({ data });
  }
  revalidatePath("/products");
  redirect("/products");
}

export async function saveCategory(formData: FormData) {
  const session = await requireSession();
  if (!isStaff(session.role)) throw new Error("Forbidden");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  await prisma.category.create({ data: { name, slug: `${slug}-${Date.now().toString(36)}` } });
  revalidatePath("/categories");
}

export async function markNotificationsRead() {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: session.userId, read: false },
    data: { read: true },
  });
  revalidatePath("/", "layout");
}

export async function saveSettings(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "SUPER_ADMIN") throw new Error("Forbidden");
  const entries = [
    ["storeName", String(formData.get("storeName") ?? "")],
    ["supportEmail", String(formData.get("supportEmail") ?? "")],
    ["currency", String(formData.get("currency") ?? "USD")],
    ["supportUrl", String(formData.get("supportUrl") ?? "")],
  ];
  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  revalidatePath("/settings");
}
