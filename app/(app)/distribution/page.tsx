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
        subtitle="Each product has a listing status under its prices. Listed SKUs appear in the store catalog and Order Sender. On Shelf keeps the same record off those lists."
      />
      {error === "listing" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Choose On Shelf or Listed.</p>
      ) : null}
      <h2 className="mb-3 text-base font-semibold text-ink">Products</h2>
      {products.length === 0 ? (
        <Card>
          <Empty title="No products yet" body="Add a product, then set listing status here." />
        </Card>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <Card key={product.id} className="p-5">
              <div className="flex items-start gap-3">
                <ProductThumb src={product.image} alt={product.title} size={72} />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted">Product</p>
                  <p className="text-lg font-semibold text-ink">{product.title}</p>
                  <p className="text-sm text-muted">{product.category.name}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-soft px-3 py-3">
                  <dt className="text-muted">Cost Price</dt>
                  <dd className="mt-1 text-base font-semibold">{money(product.cost)}</dd>
                </div>
                <div className="rounded-xl bg-soft px-3 py-3">
                  <dt className="text-muted">Selling Price</dt>
                  <dd className="mt-1 text-base font-semibold">{money(product.price)}</dd>
                </div>
              </dl>
              <ListingStatusForm productId={product.id} value={product.listingStatus} returnTo="/distribution" />
            </Card>
          ))}
        </div>
      )}
      <h2 className="mb-3 mt-8 text-base font-semibold text-ink">Picked-up orders</h2>
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
                {order.items.map((item) => (
                  <div key={item.id} className="rounded-xl bg-soft px-3 py-3">
                    <div className="flex items-start gap-3">
                      <ProductThumb src={item.image} alt={item.title} size={56} />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted">Product</p>
                        <p className="font-semibold text-ink">{item.title}</p>
                        <p className="text-xs text-muted">SKU {item.sku} · Qty {item.quantity}</p>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-white px-3 py-2">
                        <dt className="text-muted">Cost Price</dt>
                        <dd className="mt-1 font-semibold">{money(item.cost * item.quantity)}</dd>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2">
                        <dt className="text-muted">Selling Price</dt>
                        <dd className="mt-1 font-semibold">{money(item.price * item.quantity)}</dd>
                      </div>
                    </dl>
                    <ListingStatusForm
                      productId={item.productId}
                      value={item.product.listingStatus}
                      returnTo="/distribution"
                    />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
