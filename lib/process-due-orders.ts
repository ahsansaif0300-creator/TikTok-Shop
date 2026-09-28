import { prisma } from "@/lib/db";
import { PLACED_STAFF_NOTE, SCHEDULED_STAFF_NOTE } from "@/lib/order-schedule";

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

/** Reveal scheduled Order Sender orders once their set time is reached. */
export async function processDueStaffOrders(now = new Date()) {
  const due = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      notes: SCHEDULED_STAFF_NOTE,
      createdAt: { lte: now },
    },
    include: { items: true },
    take: 40,
  });
  if (due.length === 0) return 0;

  for (const order of due) {
    const first = order.items[0];
    await notifyStore(
      order.merchantId,
      "New order",
      `${order.orderNumber} for ${first?.title ?? "a product"} × ${first?.quantity ?? 1} is unpaid and waiting for pickup.`,
      "/orders",
    );
    await prisma.order.update({
      where: { id: order.id },
      data: { notes: PLACED_STAFF_NOTE },
    });
  }
  return due.length;
}
