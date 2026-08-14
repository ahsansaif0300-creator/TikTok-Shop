import Link from "next/link";
import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { money } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/labels";
import { Card, PageHeader, StatCard, StatusBadge, TableWrap, Td, Th } from "@/components/ui";
import { RevenueChart } from "@/components/charts";

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await getDashboardData(session);

  return (
    <div>
      <PageHeader
        title={session.role === "MERCHANT" ? "Store overview" : "Operations overview"}
        subtitle="Live demo workspace with seeded merchants, orders, and payouts."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross merchandise" value={money(data.gmv)} hint="Excludes unpaid and cancelled" />
        <StatCard label="Orders" value={String(data.orderCount)} hint="All statuses" />
        <StatCard
          label={session.role === "MERCHANT" ? "Pending refunds" : "Active merchants"}
          value={String(session.role === "MERCHANT" ? data.pendingRefunds : data.activeMerchants)}
        />
        <StatCard label="Open payouts" value={String(data.pendingPayouts)} hint={`${data.pendingRefunds} refunds in queue`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-ink">Revenue · last 14 days</h2>
          </div>
          <RevenueChart data={data.chart} />
        </Card>
        <Card className="p-5">
          <h2 className="font-medium text-ink">Low stock</h2>
          <div className="mt-4 space-y-3">
            {data.lowStock.map((product) => (
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
            {data.recentOrders.map((order) => (
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
