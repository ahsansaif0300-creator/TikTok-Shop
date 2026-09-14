import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { money } from "@/lib/utils";
import { LISTING_STATUS, ORDER_STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { ProductThumb } from "@/components/product-thumb";
import { ListingStatusForm } from "@/components/listing-status-form";

const PICKED = ["PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

export default async function DistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireMerchant();
  const { error } = await searchParams;
  const [products, orders] = await Promise.all([
    prisma.product.findMany({
      where: { merchantId: session.merchantId },
      include: { category: true },
      orderBy: [{ listingStatus: "asc" }, { title: "asc" }],
    }),
    prisma.order.findMany({
      where: {
        merchantId: session.merchantId,
        OR: [{ status: { in: [...PICKED] } }, { pickedAt: { not: null } }],
      },
      include: { customer: true, items: { include: { product: true } } },
      orderBy: [{ pickedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Distribution Center"
        subtitle="Mark a SKU Listed to put it in this store’s catalog, Order Sender, and staff backends. On Shelf keeps the same product record off the live list."
      />
      {error === "listing" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Choose On Shelf or Listed.</p>
      ) : null}
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Products</h2>
      {products.length === 0 ? (
        <Card>
          <Empty title="No products yet" body="Add a product, then set listing status here." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product) => {
            const profit = product.price - product.cost;
            return (
              <Card key={product.id} className="p-5">
                <div className="flex items-start gap-3">
                  <ProductThumb src={product.image} alt={product.title} size={64} />
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{product.title}</p>
                    <p className="mt-0.5 text-sm text-ink">{product.category.name}</p>
                    <p className="text-xs text-muted">
                      SKU {product.sku} · stock {product.stock}
                    </p>
                    <StatusBadge value={product.listingStatus} labels={LISTING_STATUS} />
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-soft px-2 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-muted">Cost price</dt>
                    <dd className="mt-1 font-medium">{money(product.cost)}</dd>
                  </div>
                  <div className="rounded-lg bg-soft px-2 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-muted">Profit</dt>
                    <dd className="mt-1 font-medium">{money(profit)}</dd>
                  </div>
                  <div className="rounded-lg bg-soft px-2 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-muted">Total price</dt>
                    <dd className="mt-1 font-medium">{money(product.price)}</dd>
                  </div>
                </dl>
                <ListingStatusForm productId={product.id} value={product.listingStatus} returnTo="/distribution" />
              </Card>
            );
          })}
        </div>
      )}
      <h2 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-muted">Picked-up orders</h2>
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
                        <div className="flex min-w-0 items-start gap-3">
                          <ProductThumb src={item.image} alt={item.title} size={56} />
                          <div>
                            <p className="font-medium text-ink">{item.title}</p>
                            <p className="text-xs text-muted">
                              SKU {item.sku} · Qty {item.quantity} · {LISTING_STATUS[item.product.listingStatus]}
                            </p>
                          </div>
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
                      <ListingStatusForm
                        productId={item.productId}
                        value={item.product.listingStatus}
                        returnTo="/distribution"
                      />
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
