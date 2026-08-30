"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { requestOrigin } from "@/lib/shop-url";
import { processDueReleases } from "@/lib/process-releases";
import { dummyProductImage } from "@/lib/product-image";

function fail(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

async function notifyStore(merchantId: string, title: string, body: string, href?: string) {
  const sellers = await prisma.user.findMany({
    where: { merchantId, role: "MERCHANT" },
    select: { id: true },
  });
  if (sellers.length === 0) return;
  await prisma.notification.createMany({
    data: sellers.map((user) => ({ userId: user.id, title, body, href })),
  });
}

export async function placeStaffOrder(formData: FormData) {
  const session = await requireSuperAdmin();
  const merchantId = String(formData.get("merchantId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const customerId = String(formData.get("customerId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const orderTimeRaw = String(formData.get("orderTime") ?? "").trim();
  if (!merchantId || !productId || !customerId) fail("/admin/place-order", "invalid");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) fail("/admin/place-order", "qty");

  const [merchant, product, customer] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: merchantId }, include: { plan: true } }),
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.customer.findUnique({ where: { id: customerId } }),
  ]);
  if (!merchant || merchant.status === "SUSPENDED") fail("/admin/place-order", "store");
  if (!product || product.merchantId !== merchant.id || product.status !== "ACTIVE") {
    fail("/admin/place-order", "product");
  }
  if (!customer) fail("/admin/place-order", "customer");
  if (product.stock < quantity) fail("/admin/place-order", "stock");

  const createdAt = orderTimeRaw ? new Date(orderTimeRaw) : new Date();
  if (Number.isNaN(createdAt.getTime())) fail("/admin/place-order", "time");

  const subtotal = Number((product.price * quantity).toFixed(2));
  const shippingFee = subtotal > 75 ? 0 : 6.95;
  const tax = Number((subtotal * 0.07).toFixed(2));
  const total = Number((subtotal + shippingFee + tax).toFixed(2));
  const cost = Number((product.cost * quantity).toFixed(2));
  const platformFee = Number((subtotal * merchant.plan.commissionRate).toFixed(2));
  const profit = Number((subtotal - cost - platformFee).toFixed(2));
  const now = new Date();
  const orderNumber = `HB-${createdAt.getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

  await prisma.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        orderNumber,
        merchantId: merchant.id,
        customerId: customer.id,
        status: "PROCESSING",
        subtotal,
        shippingFee,
        tax,
        total,
        cost,
        profit,
        platformFee,
        notes: "Placed by super admin",
        walletReleased: false,
        placedByUserId: session.userId,
        paidAt: createdAt,
        createdAt,
        updatedAt: now,
        items: {
          create: {
            productId: product.id,
            title: product.title,
            sku: product.sku,
            quantity,
            price: product.price,
            cost: product.cost,
            image: product.image || dummyProductImage(product.sku),
          },
        },
      },
    });
    await tx.product.update({
      where: { id: product.id },
      data: { stock: { decrement: quantity } },
    });
    await tx.merchant.update({
      where: { id: merchant.id },
      data: { pendingBalance: { increment: profit } },
    });
    await tx.ledgerEntry.create({
      data: {
        merchantId: merchant.id,
        type: "SALE",
        amount: profit,
        reference: orderNumber,
        note: "Pending settlement for staff-placed order",
        createdAt,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: session.userId,
        action: "order:place",
        entity: "Order",
        entityId: orderNumber,
        detail: `Placed ${orderNumber} on ${merchant.name} for ${customer.name}`,
      },
    });
  });

  await notifyStore(
    merchant.id,
    "New order",
    `${orderNumber} for ${product.title} × ${quantity} is ready to fulfill.`,
    "/orders",
  );
  revalidatePath("/", "layout");
  redirect(`/admin/place-order?placed=${encodeURIComponent(orderNumber)}&merchantId=${merchant.id}`);
}

export async function addStoreFunds(formData: FormData) {
  const session = await requireSuperAdmin();
  const merchantId = String(formData.get("merchantId") ?? "");
  const amount = Number(formData.get("amount") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!merchantId) fail("/admin/funds", "store");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) fail("/admin/funds", "amount");

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) fail("/admin/funds", "store");

  const reference = `ADJ-${Date.now().toString(36).toUpperCase()}`;
  await prisma.$transaction([
    prisma.merchant.update({
      where: { id: merchant.id },
      data: { availableBalance: { increment: amount } },
    }),
    prisma.ledgerEntry.create({
      data: {
        merchantId: merchant.id,
        type: "ADJUSTMENT",
        amount,
        reference,
        note: note || "Manual funds added by super admin",
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "funds:add",
        entity: "Merchant",
        entityId: merchant.id,
        detail: `Added ${amount.toFixed(2)} to ${merchant.name}`,
      },
    }),
  ]);
  await notifyStore(
    merchant.id,
    "Funds added",
    `${amount.toFixed(2)} was added to your available balance.`,
    "/finance",
  );
  revalidatePath("/", "layout");
  redirect(`/admin/funds?added=1&merchantId=${merchant.id}`);
}

export async function schedulePaymentRelease(formData: FormData) {
  const session = await requireSuperAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const hours = Number(formData.get("hours") ?? 24);
  if (!orderId) fail("/admin/releases", "invalid");
  if (!Number.isFinite(hours) || hours < 0 || hours > 168) fail("/admin/releases", "hours");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { paymentRelease: true },
  });
  if (!order) fail("/admin/releases", "order");
  const accepted = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status);
  if (!accepted || order.walletReleased) fail("/admin/releases", "status");
  if (order.paymentRelease) fail("/admin/releases", "exists");
  if (order.profit <= 0) fail("/admin/releases", "amount");

  const releaseAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await prisma.paymentRelease.create({
    data: {
      orderId: order.id,
      merchantId: order.merchantId,
      amount: order.profit,
      status: "SCHEDULED",
      releaseAt,
      createdById: session.userId,
      note: `${hours}-hour release`,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "release:schedule",
      entity: "Order",
      entityId: order.id,
      detail: `Scheduled ${order.orderNumber} release at ${releaseAt.toISOString()}`,
    },
  });
  if (hours === 0) await processDueReleases();
  revalidatePath("/", "layout");
  redirect("/admin/releases?scheduled=1");
}

export async function runDueReleasesNow() {
  await requireSuperAdmin();
  await processDueReleases();
  revalidatePath("/", "layout");
}

export async function createOpsUser(formData: FormData) {
  const session = await requireSuperAdmin();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) fail("/admin/users", "username");
  if (password.length < 8) fail("/admin/users", "password");

  const email = username.includes("@") ? username : `${username}@ops.harbor.local`;
  const taken = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (taken) fail("/admin/users", "taken");

  await prisma.user.create({
    data: {
      name: username,
      email,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role: "OPS",
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "user:ops",
      entity: "User",
      entityId: username,
      detail: `Created operations login ${username}`,
    },
  });
  revalidatePath("/admin/users");
  const origin = await requestOrigin();
  redirect(`/admin/users?created=1&username=${encodeURIComponent(username)}&login=${encodeURIComponent(`${origin}/login`)}`);
}

export async function broadcastToStores(formData: FormData) {
  const session = await requireSuperAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all");
  if (!title || !body) fail("/admin/broadcast", "invalid");
  if (audience !== "all") fail("/admin/broadcast", "audience");

  const sellers = await prisma.user.findMany({
    where: { role: "MERCHANT", merchantId: { not: null } },
    select: { id: true },
  });
  if (sellers.length > 0) {
    await prisma.notification.createMany({
      data: sellers.map((user) => ({
        userId: user.id,
        title,
        body,
        href: "/notifications",
      })),
    });
  }
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "notify:all-stores",
      entity: "Notification",
      entityId: "all",
      detail: `Broadcast "${title}" to ${sellers.length} store logins`,
    },
  });
  revalidatePath("/", "layout");
  redirect(`/admin/broadcast?sent=${sellers.length}`);
}

export async function updateStoreRecord(formData: FormData) {
  const session = await requireSuperAdmin();
  const merchantId = String(formData.get("merchantId") ?? "");
  if (!merchantId) fail("/admin/stores", "store");
  const cnicNumber = String(formData.get("cnicNumber") ?? "").trim();
  if (cnicNumber && !/^[0-9-]{5,20}$/.test(cnicNumber)) {
    fail(`/admin/stores/${merchantId}`, "cnic");
  }

  let cnicImage: string | undefined;
  const file = formData.get("cnicImage");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1_500_000) fail(`/admin/stores/${merchantId}`, "image");
    const type = file.type || "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
      fail(`/admin/stores/${merchantId}`, "image");
    }
    const buf = Buffer.from(await file.arrayBuffer());
    cnicImage = `data:${type};base64,${buf.toString("base64")}`;
  }

  await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      cnicNumber,
      ...(cnicImage ? { cnicImage } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "store:kyc",
      entity: "Merchant",
      entityId: merchantId,
      detail: `Updated store record fields for ${merchantId}`,
    },
  });
  revalidatePath(`/admin/stores/${merchantId}`);
  redirect(`/admin/stores/${merchantId}?saved=1`);
}
