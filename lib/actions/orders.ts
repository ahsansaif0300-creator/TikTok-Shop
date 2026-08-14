"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccessMerchant } from "@/lib/scope";

const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
};

async function audit(userId: string, action: string, entityId: string, detail: string) {
  await prisma.auditLog.create({
    data: { userId, action, entity: "Order", entityId, detail },
  });
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const session = await requireSession();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !canAccessMerchant(session, order.merchantId)) {
    throw new Error("Order not found");
  }
  const allowed = NEXT[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw new Error("That status change is not allowed");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status,
        paidAt: status === "PAID" ? now : order.paidAt,
        shippedAt: status === "SHIPPED" ? now : order.shippedAt,
        deliveredAt: status === "DELIVERED" ? now : order.deliveredAt,
        completedAt: status === "COMPLETED" ? now : order.completedAt,
      },
    });

    if (status === "PAID") {
      const net = order.profit;
      await tx.merchant.update({
        where: { id: order.merchantId },
        data: { pendingBalance: { increment: net } },
      });
      await tx.ledgerEntry.create({
        data: {
          merchantId: order.merchantId,
          type: "SALE",
          amount: net,
          reference: order.orderNumber,
          note: "Pending settlement for paid order",
        },
      });
    }

    if (status === "COMPLETED") {
      await tx.merchant.update({
        where: { id: order.merchantId },
        data: {
          pendingBalance: { decrement: order.profit },
          availableBalance: { increment: order.profit },
        },
      });
    }
  });

  await audit(session.userId, `status:${status}`, orderId, `Changed ${order.orderNumber} to ${status}`);
  revalidatePath("/", "layout");
}

export async function shipOrder(formData: FormData) {
  const session = await requireSession();
  const orderId = String(formData.get("orderId") ?? "");
  const carrierId = String(formData.get("carrierId") ?? "");
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim();
  if (!orderId || !carrierId || !trackingNumber) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !canAccessMerchant(session, order.merchantId)) return;
  if (order.status !== "PROCESSING" && order.status !== "PAID") return;

  const now = new Date();
  await prisma.$transaction([
    prisma.shipment.create({
      data: {
        orderId,
        carrierId,
        trackingNumber,
        status: "IN_TRANSIT",
        shippedAt: now,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: "SHIPPED", shippedAt: now },
    }),
  ]);
  await audit(session.userId, "ship", orderId, `Shipped ${order.orderNumber} via ${trackingNumber}`);
  revalidatePath("/", "layout");
}

export async function addOrderNote(formData: FormData) {
  const session = await requireSession();
  const orderId = String(formData.get("orderId") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !canAccessMerchant(session, order.merchantId)) return;
  await prisma.order.update({ where: { id: orderId }, data: { notes } });
  revalidatePath(`/orders/${orderId}`);
}
