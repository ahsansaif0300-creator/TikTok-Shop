import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { money } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { ProductThumb } from "@/components/product-thumb";
import { ListingStatusForm } from "@/components/listing-status-form";
import { productEconomics } from "@/lib/product-margin";
import { sortStoreCategories } from "@/lib/store-categories";

const PICKED = ["PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

function moneyFacts(price: number, cost: number) {
  const { profit, marginPct } = productEconomics(price, cost);
  const marginLabel = `${marginPct.toFixed(1).replace(/\.0$/, "")}%`;
  return { profit, marginLabel };
}

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
      orderBy: [{ title: "asc" }],
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

  const grouped = new Map<string, typeof products>();
  for (const product of products) {
    const list = grouped.get(product.category.name) ?? [];
    list.push(product);
    grouped.set(product.category.name, list);
  }
  const sections = sortStoreCategories([...grouped.keys()].map((name) => ({ name }))).map((category) => ({
    name: category.name,
    products: grouped.get(category.name) ?? [],
  }));

  return (
    <div>
      <PageHeader
        title="Distribution Center"
        subtitle="Products are grouped by category. Each SKU keeps one record: change On Shelf or Listed without duplicating it. Listed SKUs appear in the store catalog and Order Sender."
      />
      {error === "listing" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Choose On Shelf or Listed.</p>
      ) : null}
      <h2 className="mb-3 text-base font-semibold text-ink">Products by category</h2>
      {products.length === 0 ? (
        <Card>
          <Empty title="No products yet" body="Add a product, then set listing status here." />
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <a
                key={section.name}
                href={`#category-${section.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                className="rounded-full bg-soft px-3 py-1 text-xs font-medium text-ink hover:bg-accent-soft"
              >
                {section.name} ({section.products.length})
              </a>
            ))}
          </div>
          {sections.map((section) => (
            <section
              key={section.name}
              id={`category-${section.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
              className="scroll-mt-24"
            >
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                {section.name}
              </h3>
              <div className="space-y-4">
                {section.products.map((product) => {
                  const facts = moneyFacts(product.price, product.cost);
                  return (
                    <Card key={product.id} className="p-5">
                      <div id={`product-${product.id}`} className="scroll-mt-24">
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
                          <div className="rounded-xl bg-soft px-3 py-3">
                            <dt className="text-muted">Profit</dt>
                            <dd className="mt-1 text-base font-semibold">{money(facts.profit)}</dd>
                          </div>
                          <div className="rounded-xl bg-soft px-3 py-3">
                            <dt className="text-muted">Profit Margin</dt>
                            <dd className="mt-1 text-base font-semibold">{facts.marginLabel}</dd>
                          </div>
                        </dl>
                        <ListingStatusForm
                          productId={product.id}
                          value={product.listingStatus}
                          returnTo={`/distribution#product-${product.id}`}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
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
                {order.items.map((item) => {
                  const facts = moneyFacts(item.price, item.cost);
                  return (
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
                        <div className="rounded-lg bg-white px-3 py-2">
                          <dt className="text-muted">Profit</dt>
                          <dd className="mt-1 font-semibold">{money(facts.profit * item.quantity)}</dd>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2">
                          <dt className="text-muted">Profit Margin</dt>
                          <dd className="mt-1 font-semibold">{facts.marginLabel}</dd>
                        </div>
                      </dl>
                      <ListingStatusForm
                        productId={item.productId}
                        value={item.product.listingStatus}
                        returnTo={`/distribution#product-${item.productId}`}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
