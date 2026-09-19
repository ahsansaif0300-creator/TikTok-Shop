import type { OrderStatus } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { LiveOrder } from "@/lib/orders-live";
import { merchantScope } from "@/lib/scope";

export async function listLiveOrders(
  session: SessionUser,
  { status = "", q = "" }: { status?: string; q?: string },
): Promise<LiveOrder[]> {
  const orders = await prisma.order.findMany({
    where: {
      ...merchantScope(session),
      ...(status ? { status: status as OrderStatus } : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q } },
              { customer: { name: { contains: q } } },
              { merchant: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { merchant: true, customer: true, items: true },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    total: order.total,
    profit: order.profit,
    merchant: { name: order.merchant.name },
    customer: { name: order.customer.name, city: order.customer.city },
    items: order.items.map((item) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
    })),
  }));
}
