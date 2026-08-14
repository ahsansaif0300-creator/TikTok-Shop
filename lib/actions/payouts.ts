"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { canAccessMerchant } from "@/lib/scope";

export async function requestPayout(formData: FormData) {
  const session = await requireSession();
  const merchantId =
    session.role === "MERCHANT" ? session.merchantId : String(formData.get("merchantId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!merchantId || !Number.isFinite(amount) || amount <= 0) return;

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant || !canAccessMerchant(session, merchant.id)) return;
  if (amount > merchant.availableBalance) {
    throw new Error("Amount exceeds available balance");
  }

  const count = await prisma.payout.count();
  await prisma.payout.create({
    data: {
      payoutNumber: `PO-${String(count + 1).padStart(5, "0")}`,
      merchantId,
      amount,
      bankName: merchant.bankName ?? "Unspecified bank",
      accountLast4: merchant.bankAccountLast4 ?? "0000",
      note: String(formData.get("note") ?? ""),
    },
  });
  revalidatePath("/", "layout");
}

export async function decidePayout(payoutId: string, action: "APPROVED" | "REJECTED" | "PAID") {
  const session = await requireSession();
  if (!isStaff(session.role)) throw new Error("Forbidden");
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) return;

  if (action === "REJECTED") {
    await prisma.payout.update({
      where: { id: payoutId },
      data: { status: "REJECTED", processedAt: new Date() },
    });
  } else if (action === "APPROVED") {
    await prisma.payout.update({ where: { id: payoutId }, data: { status: "APPROVED" } });
  } else if (action === "PAID") {
    await prisma.$transaction([
      prisma.payout.update({
        where: { id: payoutId },
        data: { status: "PAID", processedAt: new Date() },
      }),
      prisma.merchant.update({
        where: { id: payout.merchantId },
        data: { availableBalance: { decrement: payout.amount } },
      }),
      prisma.ledgerEntry.create({
        data: {
          merchantId: payout.merchantId,
          type: "PAYOUT",
          amount: -payout.amount,
          reference: payout.payoutNumber,
          note: "Bank payout sent",
        },
      }),
    ]);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: `payout:${action}`,
      entity: "Payout",
      entityId: payoutId,
      detail: `${payout.payoutNumber} ${action}`,
    },
  });
  revalidatePath("/", "layout");
}
