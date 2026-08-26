import { prisma } from "@/lib/db";

let running = false;

async function releaseOne(id: string, now: Date) {
  await prisma.$transaction(async (tx) => {
    const row = await tx.paymentRelease.findFirst({
      where: { id, status: "SCHEDULED", releaseAt: { lte: now } },
      include: { order: true },
    });
    if (!row) return;

    if (row.order.walletReleased) {
      await tx.paymentRelease.update({
        where: { id: row.id },
        data: { status: "RELEASED", releasedAt: now },
      });
      return;
    }

    await tx.order.update({
      where: { id: row.orderId },
      data: { walletReleased: true },
    });
    await tx.merchant.update({
      where: { id: row.merchantId },
      data: {
        pendingBalance: { decrement: row.amount },
        availableBalance: { increment: row.amount },
      },
    });
    await tx.ledgerEntry.create({
      data: {
        merchantId: row.merchantId,
        type: "SALE",
        amount: row.amount,
        reference: row.order.orderNumber,
        note: "Scheduled payment released to available balance",
      },
    });
    await tx.paymentRelease.update({
      where: { id: row.id },
      data: { status: "RELEASED", releasedAt: now },
    });

    const sellers = await tx.user.findMany({
      where: { merchantId: row.merchantId, role: "MERCHANT" },
      select: { id: true },
    });
    if (sellers.length > 0) {
      await tx.notification.createMany({
        data: sellers.map((user) => ({
          userId: user.id,
          title: "Payment released",
          body: `${row.order.orderNumber}: ${row.amount.toFixed(2)} is now in your available balance.`,
          href: "/finance",
        })),
      });
    }
  });
}

export async function processDueReleases() {
  if (running) return 0;
  running = true;
  try {
    const now = new Date();
    const due = await prisma.paymentRelease.findMany({
      where: { status: "SCHEDULED", releaseAt: { lte: now } },
      select: { id: true },
      take: 50,
    });
    for (const item of due) {
      try {
        await releaseOne(item.id, now);
      } catch (error) {
        console.error("[harbor] payment release failed", item.id, error);
      }
    }
    return due.length;
  } catch (error) {
    console.error("[harbor] processDueReleases failed", error);
    return 0;
  } finally {
    running = false;
  }
}

let intervalStarted = false;

export function startReleaseScheduler() {
  if (intervalStarted) return;
  intervalStarted = true;
  void processDueReleases();
  setInterval(() => {
    void processDueReleases();
  }, 30_000);
}
