import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { money } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";

const PICKED = ["PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

export default async function DistributionPage() {
  const session = await requireMerchant();
  const orders = await prisma.order.findMany({
    where: {
      merchantId: session.merchantId,
      OR: [{ status: { in: [...PICKED] } }, { pickedAt: { not: null } }],
    },
    include: { customer: true, items: true },
    orderBy: [{ pickedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <PageHeader
        title="Distribution Center"
        subtitle="Products and orders this store has already picked up. Cost, profit, and selling price are shown separately."
      />
      {orders.length === 0 ? (
        <Card>
          <Empty title="Nothing in distribution yet" body="Picked-up orders appear here after Click to Pick Up succeeds." />
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/orders/${order.id}`} className="font-medium text-accent hover:underline">
                    {order.orderNumber}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {order.customer.name} · {format(order.pickedAt ?? order.createdAt, "MMM d, yyyy HH:mm")}
                  </p>
                </div>
                <StatusBadge
                  value={order.status}
                  labels={{ ...ORDER_STATUS, PROCESSING: order.pickedAt ? "Picked up" : ORDER_STATUS.PROCESSING }}
                />
              </div>
              <div className="mt-4 space-y-3">
                {order.items.map((item) => {
                  const cost = item.cost * item.quantity;
                  const total = item.price * item.quantity;
                  const profit = total - cost;
                  return (
                    <div key={item.id} className="rounded-xl bg-soft px-3 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{item.title}</p>
                          <p className="text-xs text-muted">
                            SKU {item.sku} · Qty {item.quantity}
                          </p>
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white px-2 py-2">
                          <dt className="text-[11px] uppercase tracking-wide text-muted">Cost price</dt>
                          <dd className="mt-1 font-medium">{money(cost)}</dd>
                        </div>
                        <div className="rounded-lg bg-white px-2 py-2">
                          <dt className="text-[11px] uppercase tracking-wide text-muted">Profit</dt>
                          <dd className="mt-1 font-medium">{money(profit)}</dd>
                        </div>
                        <div className="rounded-lg bg-white px-2 py-2">
                          <dt className="text-[11px] uppercase tracking-wide text-muted">Total price</dt>
                          <dd className="mt-1 font-medium">{money(total)}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
                <span>Order total {money(order.total)}</span>
                <span>Order cost {money(order.cost)}</span>
                <span>Merchant profit {money(order.profit)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
