"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { canAccessMerchant } from "@/lib/scope";

export async function saveProduct(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const merchantId =
    session.role === "MERCHANT" ? session.merchantId : String(formData.get("merchantId") ?? "");
  if (!merchantId || !canAccessMerchant(session, merchantId)) return;

  const data = {
    merchantId,
    categoryId: String(formData.get("categoryId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    sku: String(formData.get("sku") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    price: Number(formData.get("price") ?? 0),
    cost: Number(formData.get("cost") ?? 0),
    stock: Number(formData.get("stock") ?? 0),
    status: (String(formData.get("status") ?? "ACTIVE") as ProductStatus) || "ACTIVE",
  };
  if (!data.title || !data.sku || !data.categoryId) return;

  if (id) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || !canAccessMerchant(session, existing.merchantId)) return;
    await prisma.product.update({ where: { id }, data });
  } else {
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
