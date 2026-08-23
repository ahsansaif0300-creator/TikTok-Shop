import Link from "next/link";
import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { money } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, StatCard, StatusBadge, TableWrap, Td, Th } from "@/components/ui";
import { RevenueChart } from "@/components/charts";

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await getDashboardData(session);
  const merchant = session.role === "MERCHANT";
  const attention = (
    merchant
      ? [
          data.pendingRefunds
            ? { href: "/refunds", label: `${data.pendingRefunds} refunds waiting on ops` }
            : null,
          data.pendingPayouts
            ? { href: "/finance/payouts", label: `${data.pendingPayouts} open payouts` }
            : null,
          data.lowStock.length
            ? { href: "/products", label: `${data.lowStock.length} products at or below 20 units` }
            : null,
        ]
      : [
          data.pendingApplications
            ? { href: "/merchants/applications", label: `${data.pendingApplications} seller applications` }
            : null,
          data.pendingRefunds
            ? { href: "/refunds", label: `${data.pendingRefunds} refunds in queue` }
            : null,
          data.awaitingFulfillment
            ? { href: "/orders?status=PROCESSING", label: `${data.awaitingFulfillment} orders awaiting shipment` }
            : null,
          data.pendingPayouts
            ? { href: "/finance/payouts", label: `${data.pendingPayouts} payouts to review` }
            : null,
        ]
  ).filter((item): item is { href: string; label: string } => item !== null);

  return (
    <div>
      <PageHeader
        title={merchant ? "Store overview" : "Operations overview"}
        subtitle={
          merchant
            ? `${data.store?.name ?? "Your store"} · catalog, orders, and bank balances from real sales.`
            : "All merchants · live orders, onboarding, and payouts."
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross merchandise" value={money(data.gmv)} hint="Excludes unpaid and cancelled" />
        <StatCard label="Orders" value={String(data.orderCount)} hint="All statuses" />
        {merchant ? (
          <>
            <StatCard
              label="Available balance"
              value={money(data.store?.availableBalance ?? 0)}
              hint="Ready for bank payout"
            />
            <StatCard
              label="Pending balance"
              value={money(data.store?.pendingBalance ?? 0)}
              hint="Settles after delivery is completed"
            />
          </>
        ) : (
          <>
            <StatCard label="Active merchants" value={String(data.activeMerchants)} hint="Approved and selling" />
            <StatCard
              label="Open payouts"
              value={String(data.pendingPayouts)}
              hint={`${data.pendingRefunds} refunds in queue`}
            />
          </>
        )}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-ink">Revenue · last 14 days</h2>
          </div>
          <RevenueChart data={data.chart} />
        </Card>
        <div className="grid gap-6">
          <Card className="p-5">
            <h2 className="font-medium text-ink">Needs attention</h2>
            {attention.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing waiting right now.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {attention.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-xl bg-[#f6f1e8] px-3 py-2 text-sm text-ink hover:bg-[#efe6d6]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="font-medium text-ink">Low stock</h2>
            {data.lowStock.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No active SKUs at or below 20 units.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.lowStock.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="flex items-center justify-between rounded-xl bg-[#f6f1e8] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{product.title}</p>
                      {merchant ? null : <p className="text-xs text-muted">{product.merchant.name}</p>}
                    </div>
                    <p className="text-sm font-semibold text-amber-800">{product.stock}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      <Card className="mt-6">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-medium text-ink">Recent orders</h2>
          <Link href="/orders" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <Empty title="No orders yet" body="New paid orders will show up here." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                {merchant ? null : <Th>Merchant</Th>}
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
                  {merchant ? null : <Td>{order.merchant.name}</Td>}
                  <Td>{order.customer.name}</Td>
                  <Td>
                    <StatusBadge value={order.status} labels={ORDER_STATUS} />
                  </Td>
                  <Td>{money(order.total)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
