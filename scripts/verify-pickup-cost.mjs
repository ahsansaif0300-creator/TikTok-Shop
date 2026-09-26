#!/usr/bin/env node
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const { orderPickupCharge } = await import(path.join(root, "lib/order-pickup.ts"));

const cost = 12.16;
const total = 24.07;
const charge = orderPickupCharge({ cost, total });
if (charge !== 12.16) throw new Error(`pickup charged ${charge}, expected cost 12.16`);
if (charge === total) throw new Error("pickup must not charge total price");
if (12.16 < charge) throw new Error("cost funds should be enough to pick up");
if (12.16 >= total) throw new Error("cost funds must not be enough for total price");

const dir = mkdtempSync(path.join(os.tmpdir(), "harbor-pickup-cost-"));
const db = path.join(dir, "harbor-commerce.sqlite");
copyFileSync(path.join(root, "prisma", "demo.sqlite"), db);
const prisma = new PrismaClient({ datasources: { db: { url: `file:${db}` } } });

try {
  const plan = await prisma.plan.findFirst({ orderBy: { monthlyFee: "asc" } });
  if (!plan) throw new Error("demo plan missing");
  const profit = Math.round((total - cost) * 100) / 100;
  const merchant = await prisma.merchant.create({
    data: {
      name: "Cost Pickup Store",
      slug: `cost-pickup-${Date.now()}`,
      legalName: "Cost Pickup LLC",
      email: "cost.pickup@example.test",
      phone: "1",
      country: "US",
      city: "Test",
      address: "1",
      status: "ACTIVE",
      planId: plan.id,
      availableBalance: cost,
    },
  });
  const customer = await prisma.customer.create({
    data: {
      name: "Buyer",
      email: `cost.buyer.${Date.now()}@example.test`,
      phone: "1",
      address: "1",
      city: "Test",
      country: "US",
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `COST-${Date.now()}`,
      merchantId: merchant.id,
      customerId: customer.id,
      status: "PENDING_PAYMENT",
      subtotal: total,
      shippingFee: 0,
      tax: 0,
      total,
      cost,
      profit,
      platformFee: 0,
    },
  });

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "PAID", pickupHold: charge },
    });
    if (claimed.count !== 1) throw new Error("claim failed");
    const row = await tx.merchant.findUnique({ where: { id: merchant.id } });
    if (!row || row.availableBalance < charge) throw new Error("Insufficient Balance");
    if (row.availableBalance >= total) throw new Error("fixture must be below total price");
    await tx.merchant.update({
      where: { id: merchant.id },
      data: { availableBalance: { decrement: charge }, pendingBalance: { increment: profit } },
    });
  });

  const fresh = await prisma.merchant.findUnique({ where: { id: merchant.id } });
  const paid = await prisma.order.findUnique({ where: { id: order.id } });
  if (paid.pickupHold !== 12.16) throw new Error(`hold ${paid.pickupHold}`);
  if (fresh.availableBalance !== 0) throw new Error(`available ${fresh.availableBalance}`);
  if (fresh.pendingBalance !== profit) throw new Error(`pending ${fresh.pendingBalance}`);

  console.log(
    JSON.stringify({
      ok: true,
      cost,
      total,
      charged: charge,
      available: fresh.availableBalance,
      pending: fresh.pendingBalance,
      hold: paid.pickupHold,
    }),
  );
} finally {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
}
