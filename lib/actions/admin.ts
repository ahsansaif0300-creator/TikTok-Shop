"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { requestOrigin } from "@/lib/shop-url";
import { processDueReleases } from "@/lib/process-releases";
import { dummyProductImage } from "@/lib/product-image";
import { isListedProduct, listedCatalogWhere } from "@/lib/product-listing";
import { allocateReferralCode } from "@/lib/referral";
import { snapshotOpsUsers } from "@/lib/ops-users-store";
import { snapshotStores } from "@/lib/stores-persist";
import { parseStoreCreditScore, parseStoreRating } from "@/lib/store-score";
import { orderProfitAmount } from "@/lib/order-economics";

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

function failPlace(code: string, merchantId?: string): never {
  const query = new URLSearchParams({ error: code });
  if (merchantId) query.set("merchantId", merchantId);
  redirect(`/admin/place-order?${query.toString()}`);
}

export async function placeStaffOrder(formData: FormData) {
  const session = await requireSuperAdmin();
  const merchantId = String(formData.get("merchantId") ?? "");
  const customerId = String(formData.get("customerId") ?? "");
  const intent = String(formData.get("intent") ?? "selected");
  const quantity = Number(formData.get("quantity") ?? 1);
  const orderTimeRaw = String(formData.get("orderTime") ?? "").trim();
  if (!merchantId || !customerId) failPlace("invalid", merchantId);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) failPlace("qty", merchantId);

  const [merchant, customer] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: merchantId }, include: { plan: true } }),
    prisma.customer.findUnique({ where: { id: customerId } }),
  ]);
  if (!merchant || merchant.status === "SUSPENDED") failPlace("store", merchantId);
  if (!customer) failPlace("customer", merchantId);

  const requestedIds = [...new Set(formData.getAll("productId").map((value) => String(value)).filter(Boolean))];
  const listed = await prisma.product.findMany({
    where: { merchantId: merchant.id, ...listedCatalogWhere },
  });
  const products = intent === "all" ? listed : listed.filter((product) => requestedIds.includes(product.id));
  if (intent !== "all" && requestedIds.length === 0) failPlace("select", merchant.id);
  if (products.length === 0) failPlace("product", merchant.id);
  if (intent !== "all" && products.length !== requestedIds.length) failPlace("product", merchant.id);
  if (products.some((product) => !isListedProduct(product))) failPlace("product", merchant.id);
  const sendable = intent === "all" ? products.filter((product) => product.stock >= quantity) : products;
  if (sendable.length === 0 || sendable.some((product) => product.stock < quantity)) failPlace("stock", merchant.id);

  const createdAt = orderTimeRaw ? new Date(orderTimeRaw) : new Date();
  if (Number.isNaN(createdAt.getTime())) failPlace("time", merchant.id);

  const now = new Date();
  const stamp = Date.now().toString(36).toUpperCase();
  const numbers: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const [index, product] of sendable.entries()) {
      const subtotal = Number((product.price * quantity).toFixed(2));
      const shippingFee = subtotal > 75 ? 0 : 6.95;
      const tax = Number((subtotal * 0.07).toFixed(2));
      const total = Number((subtotal + shippingFee + tax).toFixed(2));
      const cost = Number((product.cost * quantity).toFixed(2));
      const platformFee = Number((subtotal * merchant.plan.commissionRate).toFixed(2));
      const profit = orderProfitAmount(total, cost);
      const orderNumber = `HB-${createdAt.getFullYear()}-${stamp}${index.toString(36).toUpperCase()}`;
      numbers.push(orderNumber);
      await tx.order.create({
        data: {
          orderNumber,
          merchantId: merchant.id,
          customerId: customer.id,
          status: "PENDING_PAYMENT",
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
          paidAt: null,
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
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "order:place",
          entity: "Order",
          entityId: orderNumber,
          detail: `Placed ${orderNumber} on ${merchant.name} for ${customer.name}`,
        },
      });
    }
  });

  const first = sendable[0];
  await notifyStore(
    merchant.id,
    numbers.length === 1 ? "New order" : "New orders",
    numbers.length === 1
      ? `${numbers[0]} for ${first?.title ?? "a product"} × ${quantity} is unpaid and waiting for pickup.`
      : `${numbers.length} unpaid orders are waiting for pickup.`,
    "/orders",
  );
  revalidatePath("/", "layout");
  revalidatePath("/orders");
  redirect(`/admin/place-order?placed=${encodeURIComponent(numbers.join(","))}&merchantId=${merchant.id}`);
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

  const referralCode = await allocateReferralCode();
  await prisma.user.create({
    data: {
      name: username,
      email,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role: "OPS",
      referralCode,
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
  await snapshotOpsUsers(prisma);
  revalidatePath("/admin/users");
  const origin = await requestOrigin();
  redirect(
    `/admin/users?created=1&username=${encodeURIComponent(username)}&login=${encodeURIComponent(`${origin}/login/ops`)}&referral=${encodeURIComponent(referralCode)}`,
  );
}

export async function deleteOpsUser(formData: FormData) {
  const session = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, role: true },
  });
  if (!user || user.role !== "OPS") fail("/admin/users", "missing");
  await prisma.$transaction(async (tx) => {
    await tx.merchant.updateMany({ where: { referredByUserId: user.id }, data: { referredByUserId: null } });
    await tx.merchantApplication.updateMany({ where: { referredByUserId: user.id }, data: { referredByUserId: null } });
    await tx.merchantApplication.updateMany({ where: { reviewerId: user.id }, data: { reviewerId: null } });
    await tx.order.updateMany({ where: { placedByUserId: user.id }, data: { placedByUserId: null } });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.updateMany({ where: { userId: user.id }, data: { userId: null } });
    await tx.supportMessage.updateMany({ where: { userId: user.id }, data: { userId: null } });
    await tx.user.delete({ where: { id: user.id } });
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "user:ops-delete",
      entity: "User",
      entityId: user.id,
      detail: `Deleted operations login ${user.username || user.email}`,
    },
  });
  await snapshotOpsUsers(prisma);
  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
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

  let cnicImageFront: string | undefined;
  let cnicImageBack: string | undefined;
  const front = formData.get("cnicImageFront");
  const back = formData.get("cnicImageBack");
  const legacy = formData.get("cnicImage");
  async function readId(file: FormDataEntryValue | null, path: string) {
    if (!(file instanceof File) || file.size === 0) return undefined;
    if (file.size > 1_000_000) fail(path, "image");
    const type = file.type || "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) fail(path, "image");
    const buf = Buffer.from(await file.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  }
  const path = `/admin/stores/${merchantId}`;
  cnicImageFront = await readId(front, path);
  cnicImageBack = await readId(back, path);
  const cnicImage = cnicImageFront ?? (await readId(legacy, path));

  await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      cnicNumber,
      ...(cnicImage ? { cnicImage } : {}),
      ...(cnicImageFront ? { cnicImageFront } : {}),
      ...(cnicImageBack ? { cnicImageBack } : {}),
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
  await snapshotStores(prisma);
  revalidatePath(`/admin/stores/${merchantId}`);
  redirect(`/admin/stores/${merchantId}?saved=1`);
}

export async function updateStoreScore(formData: FormData) {
  const session = await requireSuperAdmin();
  const merchantId = String(formData.get("merchantId") ?? "");
  if (!merchantId) fail("/admin/stores", "store");
  const rating = parseStoreRating(formData.get("rating"));
  const creditScore = parseStoreCreditScore(formData.get("creditScore"));
  if (rating === null || creditScore === null) {
    fail(`/admin/stores/${merchantId}`, "score");
  }

  const store = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, name: true },
  });
  if (!store) fail("/admin/stores", "store");

  await prisma.merchant.update({
    where: { id: merchantId },
    data: { rating, creditScore },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "store:score",
      entity: "Merchant",
      entityId: merchantId,
      detail: `Set ${store.name} rating ${rating} and credit score ${creditScore}/100`,
    },
  });
  await snapshotStores(prisma);
  revalidatePath("/");
  revalidatePath("/admin/stores");
  revalidatePath(`/admin/stores/${merchantId}`);
  redirect(`/admin/stores/${merchantId}?saved=score`);
}
