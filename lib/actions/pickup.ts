"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { canAccessMerchant } from "@/lib/scope";

export async function pickUpOrder(formData: FormData) {
  const session = await requireMerchant();
  const orderId = String(formData.get("orderId") ?? "");
  const paymentPassword = String(formData.get("paymentPassword") ?? "");
  if (!orderId) redirect("/orders?error=invalid");
  if (!paymentPassword) redirect(`/orders?error=paypass&id=${orderId}`);

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.paymentPasswordHash) {
    redirect("/account?error=paypass");
  }
  if (!(await bcrypt.compare(paymentPassword, user.paymentPasswordHash))) {
    redirect(`/orders?error=paypass&id=${orderId}`);
  }

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing || !canAccessMerchant(session, existing.merchantId)) {
    redirect("/orders?error=invalid");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, merchantId: session.merchantId, status: "PAID" },
        data: { status: "PROCESSING", pickedAt: new Date(), pickupHold: existing.total },
      });
      if (claimed.count !== 1) {
        throw new Error("already");
      }

      const merchant = await tx.merchant.findUnique({ where: { id: session.merchantId } });
      if (!merchant || merchant.availableBalance < existing.total) {
        throw new Error("Insufficient Balance");
      }

      await tx.merchant.update({
        where: { id: session.merchantId },
        data: { availableBalance: { decrement: existing.total } },
      });
      await tx.ledgerEntry.create({
        data: {
          merchantId: session.merchantId,
          type: "ADJUSTMENT",
          amount: -existing.total,
          reference: existing.orderNumber,
          note: "Pickup reserve",
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "order:pickup",
          entity: "Order",
          entityId: orderId,
          detail: `Picked up ${existing.orderNumber}`,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Insufficient Balance") {
      redirect(`/orders?error=balance&id=${orderId}`);
    }
    if (message === "already") {
      redirect(`/orders?error=picked&id=${orderId}`);
    }
    throw error;
  }

  revalidatePath("/", "layout");
  redirect("/orders?picked=1");
}
