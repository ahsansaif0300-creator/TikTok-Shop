import { format, subDays } from "date-fns";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { merchantScope } from "@/lib/scope";

export async function getDashboardData(session: SessionUser) {
  const scope = merchantScope(session);
  const now = new Date();
  const since = subDays(now, 14);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const isMerchant = session.role === "MERCHANT";

  const [
    orderCount,
    paidOrders,
    todayOrders,
    todaySales,
    pendingRefunds,
    pendingPayouts,
    activeMerchants,
    pendingApplications,
    awaitingFulfillment,
    readyToPickUp,
    store,
    recentOrders,
    chartOrders,
    lowStock,
  ] = await Promise.all([
    prisma.order.count({ where: scope }),
    prisma.order.aggregate({
      where: { ...scope, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
      _sum: { total: true },
    }),
    prisma.order.count({
      where: { ...scope, createdAt: { gte: startOfDay }, status: { not: "CANCELLED" } },
    }),
    prisma.order.aggregate({
      where: {
        ...scope,
        createdAt: { gte: startOfDay },
        status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] },
      },
      _sum: { total: true },
    }),
    prisma.refund.count({ where: { status: "PENDING", order: scope } }),
    prisma.payout.count({ where: { status: { in: ["PENDING", "APPROVED"] }, ...scope } }),
    prisma.merchant.count({
      where: isMerchant ? { id: session.merchantId ?? "__none__" } : { status: "ACTIVE" },
    }),
    isMerchant
      ? Promise.resolve(0)
      : prisma.merchantApplication.count({ where: { status: "PENDING" } }),
    prisma.order.count({
      where: { ...scope, status: { in: ["PAID", "PROCESSING"] } },
    }),
    prisma.order.count({
      where: { ...scope, status: "PAID" },
    }),
    isMerchant && session.merchantId
      ? prisma.merchant.findUnique({
          where: { id: session.merchantId },
          select: { name: true, slug: true, availableBalance: true, pendingBalance: true },
        })
      : Promise.resolve(null),
    prisma.order.findMany({
      where: scope,
      include: { merchant: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.order.findMany({
      where: { ...scope, createdAt: { gte: since }, status: { not: "CANCELLED" } },
      select: { createdAt: true, total: true },
    }),
    prisma.product.findMany({
      where: { ...scope, stock: { lte: 20 }, status: "ACTIVE" },
      include: { merchant: true },
      orderBy: { stock: "asc" },
      take: 6,
    }),
  ]);

  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (let i = 13; i >= 0; i--) {
    const day = format(subDays(now, i), "MMM d");
    byDay.set(day, { revenue: 0, orders: 0 });
  }
  for (const order of chartOrders) {
    const day = format(order.createdAt, "MMM d");
    const current = byDay.get(day);
    if (current) {
      current.revenue += order.total;
      current.orders += 1;
    }
  }

  return {
    orderCount,
    gmv: paidOrders._sum.total ?? 0,
    todayOrderCount: todayOrders,
    todaySales: todaySales._sum.total ?? 0,
    pendingRefunds,
    pendingPayouts,
    activeMerchants,
    pendingApplications,
    awaitingFulfillment,
    readyToPickUp,
    store,
    recentOrders,
    chart: [...byDay.entries()].map(([day, value]) => ({ day, ...value })),
    lowStock,
  };
}
