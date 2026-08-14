import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { money } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/labels";
import { Card, PageHeader, StatCard, StatusBadge, TableWrap, Td, Th } from "@/components/ui";
import { RevenueChart } from "@/components/charts";

export default async function DashboardPage() {
  const session = await requireSession();
  const scope = merchantScope(session);
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    orderCount,
    paidOrders,
    pendingRefunds,
    pendingPayouts,
    activeMerchants,
    recentOrders,
    chartOrders,
    lowStock,
  ] = await Promise.all([
    prisma.order.count({ where: scope }),
    prisma.order.aggregate({
      where: { ...scope, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
      _sum: { total: true },
    }),
    prisma.refund.count({ where: { status: "PENDING", order: scope } }),
    prisma.payout.count({ where: { status: { in: ["PENDING", "APPROVED"] }, ...scope } }),
    prisma.merchant.count({ where: session.role === "MERCHANT" ? { id: session.merchantId ?? "__none__" } : { status: "ACTIVE" } }),
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
    const day = format(new Date(Date.now() - i * 86400000), "MMM d");
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
  const chart = [...byDay.entries()].map(([day, value]) => ({ day, ...value }));

  return (
    <div>
      <PageHeader
        title={session.role === "MERCHANT" ? "Store overview" : "Operations overview"}
        subtitle="Live demo workspace with seeded merchants, orders, and payouts."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross merchandise" value={money(paidOrders._sum.total ?? 0)} hint="Excludes unpaid and cancelled" />
        <StatCard label="Orders" value={String(orderCount)} hint="All statuses" />
        <StatCard
          label={session.role === "MERCHANT" ? "Pending refunds" : "Active merchants"}
          value={String(session.role === "MERCHANT" ? pendingRefunds : activeMerchants)}
        />
        <StatCard label="Open payouts" value={String(pendingPayouts)} hint={`${pendingRefunds} refunds in queue`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-ink">Revenue · last 14 days</h2>
          </div>
          <RevenueChart data={chart} />
        </Card>
        <Card className="p-5">
          <h2 className="font-medium text-ink">Low stock</h2>
          <div className="mt-4 space-y-3">
            {lowStock.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`} className="flex items-center justify-between rounded-xl bg-[#f6f1e8] px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{product.title}</p>
                  <p className="text-xs text-muted">{product.merchant.name}</p>
                </div>
                <p className="text-sm font-semibold text-amber-800">{product.stock}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-6">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-medium text-ink">Recent orders</h2>
          <Link href="/orders" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        <TableWrap>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Merchant</Th>
              <Th>Customer</Th>
              <Th>Status</Th>
              <Th>Total</Th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr key={order.id} className="hover:bg-[#faf6ef]">
                <Td>
                  <Link href={`/orders/${order.id}`} className="font-medium text-accent hover:underline">
                    {order.orderNumber}
                  </Link>
                  <p className="text-xs text-muted">{format(order.createdAt, "MMM d, yyyy")}</p>
                </Td>
                <Td>{order.merchant.name}</Td>
                <Td>{order.customer.name}</Td>
                <Td>
                  <StatusBadge value={order.status} labels={ORDER_STATUS} />
                </Td>
                <Td>{money(order.total)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
