"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { canAccessMerchant, catalogMerchantId } from "@/lib/scope";
import { canDecidePayout, type PayoutDecision } from "@/lib/payout-flow";

function payoutReturnTo(formData: FormData) {
  return String(formData.get("returnTo") ?? "") === "withdraw" ? "/withdraw" : "/finance/payouts";
}

export async function requestPayout(formData: FormData) {
  const session = await requireSession();
  const dest = payoutReturnTo(formData);
  const merchantId = catalogMerchantId(session, String(formData.get("merchantId") ?? ""));
  const amount = Number(formData.get("amount") ?? 0);
  const accountHolder = String(formData.get("accountHolder") ?? formData.get("fullName") ?? "").trim();
  const bankName = String(formData.get("bankName") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").replace(/\s+/g, "");
  if (!merchantId || !Number.isFinite(amount) || amount <= 0) {
    redirect(`${dest}?error=invalid`);
  }

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant || !canAccessMerchant(session, merchant.id)) {
    redirect(`${dest}?error=forbidden`);
  }
  if (amount > merchant.availableBalance) {
    redirect(`${dest}?error=balance`);
  }

  const resolvedBank = bankName || merchant.bankName || "Unspecified bank";
  const resolvedAccount = accountNumber || (merchant.bankAccountLast4 ? `••••${merchant.bankAccountLast4}` : "");
  const last4 = resolvedAccount.slice(-4) || merchant.bankAccountLast4 || "0000";
  if (session.role === "MERCHANT" && dest === "/withdraw") {
    if (!accountHolder || !bankName || accountNumber.length < 4) {
      redirect("/withdraw?error=details");
    }
  }

  const count = await prisma.payout.count();
  await prisma.payout.create({
    data: {
      payoutNumber: `PO-${String(count + 1).padStart(5, "0")}`,
      merchantId,
      amount,
      bankName: resolvedBank,
      accountLast4: last4,
      accountHolder,
      accountNumber: resolvedAccount,
      note: String(formData.get("note") ?? ""),
    },
  });
  revalidatePath("/", "layout");
  redirect(`${dest}?requested=1`);
}

export async function decidePayout(payoutId: string, action: PayoutDecision) {
  const session = await requireSession();
  if (!isStaff(session.role)) throw new Error("Forbidden");
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) return;
  if (!canDecidePayout(payout.status, action)) {
    redirect("/finance/payouts?error=status");
  }

  if (action === "REJECTED") {
    await prisma.payout.update({
      where: { id: payoutId },
      data: { status: "REJECTED", processedAt: new Date() },
    });
  } else if (action === "APPROVED") {
    await prisma.payout.update({ where: { id: payoutId }, data: { status: "APPROVED" } });
  } else if (action === "PAID") {
    const merchant = await prisma.merchant.findUnique({ where: { id: payout.merchantId } });
    if (!merchant || merchant.availableBalance < payout.amount) {
      redirect("/finance/payouts?error=balance");
    }
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
