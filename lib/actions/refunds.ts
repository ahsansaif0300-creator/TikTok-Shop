"use server";

import { revalidatePath } from "next/cache";
import type { RefundStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { canAccessMerchant } from "@/lib/scope";

export async function decideRefund(refundId: string, status: RefundStatus, note?: string) {
  const session = await requireSession();
  if (!isStaff(session.role)) {
    throw new Error("Only operations staff can decide refunds");
  }

  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { order: { include: { items: true } } },
  });
  if (!refund || refund.status !== "PENDING") return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refundId },
      data: { status, adminNote: note ?? refund.adminNote, resolvedAt: now },
    });

    if (status === "COMPLETED" || status === "APPROVED") {
      const merchant = await tx.merchant.findUnique({ where: { id: refund.order.merchantId } });
      if (!merchant) return;
      const fromAvailable = Math.min(merchant.availableBalance, refund.amount);
      const fromPending = Math.min(merchant.pendingBalance, refund.amount - fromAvailable);
      await tx.merchant.update({
        where: { id: merchant.id },
        data: {
          availableBalance: { decrement: fromAvailable },
          pendingBalance: { decrement: fromPending },
        },
      });
      await tx.ledgerEntry.create({
        data: {
          merchantId: merchant.id,
          type: "REFUND",
          amount: -refund.amount,
          reference: refund.refundNumber,
          note: `Refund for ${refund.order.orderNumber}`,
        },
      });
      if (refund.restock) {
        for (const item of refund.order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      if (status === "APPROVED") {
        await tx.refund.update({
          where: { id: refundId },
          data: { status: "COMPLETED" },
        });
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: `refund:${status}`,
      entity: "Refund",
      entityId: refundId,
      detail: `${refund.refundNumber} ${status}`,
    },
  });
  revalidatePath("/", "layout");
}

export async function createRefund(formData: FormData) {
  const session = await requireSession();
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const type = String(formData.get("type") ?? "REFUND_ONLY") as
    | "REFUND_ONLY"
    | "RETURN_AND_REFUND"
    | "EXCHANGE";
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !canAccessMerchant(session, order.merchantId) || !reason) return;
  if (order.status === "PENDING_PAYMENT" || order.status === "CANCELLED") return;

  const count = await prisma.refund.count();
  await prisma.refund.create({
    data: {
      refundNumber: `RF-${String(count + 1).padStart(5, "0")}`,
      orderId,
      type,
      reason,
      amount: order.total,
      restock: type !== "REFUND_ONLY",
    },
  });
  revalidatePath("/", "layout");
}

export async function approveRefund(refundId: string) {
  await decideRefund(refundId, "APPROVED");
}

export async function rejectRefund(refundId: string) {
  await decideRefund(refundId, "REJECTED");
}
