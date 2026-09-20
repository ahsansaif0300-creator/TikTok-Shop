import Link from "next/link";
import { format } from "date-fns";
import type { Product } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { ensureDatabase } from "@/lib/ensure-db";
import { money } from "@/lib/utils";
import { LISTING_STATUS, ORDER_STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { ProductThumb } from "@/components/product-thumb";
import { ListingStatusForm } from "@/components/listing-status-form";
import { productEconomics } from "@/lib/product-margin";
import { STORE_CATEGORIES, categorySlug } from "@/lib/store-categories";
import { ensureMerchantCatalog } from "@/lib/sync-distribution-catalog";

const PICKED = ["PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

type CatalogProduct = Product & { category: { name: string } };

function moneyFacts(price: number, cost: number) {
  const { profit, marginPct } = productEconomics(price, cost);
  const marginLabel = `${marginPct.toFixed(1).replace(/\.0$/, "")}%`;
  return { profit, marginLabel };
}

function listingReturn(categorySlugValue: string, productId: string) {
  return `/distribution?category=${categorySlugValue}#product-${productId}`;
}

function ProductEconomicsGrid({
  cost,
  price,
  compact = false,
}: {
  cost: number;
  price: number;
  compact?: boolean;
}) {
  const facts = moneyFacts(price, cost);
  const box = compact ? "rounded-lg bg-white px-2 py-2" : "rounded-xl bg-soft px-3 py-3";
  return (
    <dl className={`grid grid-cols-2 gap-2 text-sm ${compact ? "mt-3" : "mt-4 gap-3"}`}>
      <div className={box}>
        <dt className="text-muted">Cost Price</dt>
        <dd className={`mt-1 font-semibold ${compact ? "" : "text-base"}`}>{money(cost)}</dd>
      </div>
      <div className={box}>
        <dt className="text-muted">Selling Price</dt>
        <dd className={`mt-1 font-semibold ${compact ? "" : "text-base"}`}>{money(price)}</dd>
      </div>
      <div className={box}>
        <dt className="text-muted">Profit</dt>
        <dd className={`mt-1 font-semibold ${compact ? "" : "text-base"}`}>{money(facts.profit)}</dd>
      </div>
      <div className={box}>
        <dt className="text-muted">Profit Margin</dt>
        <dd className={`mt-1 font-semibold ${compact ? "" : "text-base"}`}>{facts.marginLabel}</dd>
      </div>
    </dl>
  );
}

function ProductCard({
  product,
  categoryKey,
}: {
  product: CatalogProduct;
  categoryKey: string;
}) {
  return (
    <Card className="p-5">
      <div id={`product-${product.id}`} className="scroll-mt-28">
        <div className="flex items-start gap-3">
          <ProductThumb src={product.image} alt={product.title} size={72} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted">Product</p>
            <p className="text-lg font-semibold text-ink">{product.title}</p>
            <p className="text-sm text-muted">{product.category.name}</p>
          </div>
        </div>
        <ProductEconomicsGrid cost={product.cost} price={product.price} />
        <ListingStatusForm
          productId={product.id}
          value={product.listingStatus}
          returnTo={listingReturn(categoryKey, product.id)}
        />
      </div>
    </Card>
  );
}

function ShelfCard({
  product,
  categoryKey,
}: {
  product: CatalogProduct;
  categoryKey: string;
}) {
  const facts = moneyFacts(product.price, product.cost);
  return (
    <Link
      href={listingReturn(categoryKey, product.id)}
      className="w-[220px] shrink-0 rounded-2xl border border-line bg-card p-3 shadow-[0_1px_2px_rgba(22,24,35,0.04)]"
    >
      <ProductThumb src={product.image} alt={product.title} size={196} />
      <p className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold text-ink">{product.title}</p>
      <p className="mt-1 text-xs text-muted">{product.category.name}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{money(product.price)}</p>
      <p className="text-xs text-muted">
        Cost {money(product.cost)} · Profit {money(facts.profit)} · {facts.marginLabel}
      </p>
      <p className="mt-2 text-xs font-semibold text-ink">Status: {LISTING_STATUS[product.listingStatus]}</p>
    </Link>
  );
}

export default async function DistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; category?: string }>;
}) {
  await ensureDatabase();
  const session = await requireMerchant();
  await ensureMerchantCatalog(prisma, session.merchantId);
  const { error, category: categoryParam } = await searchParams;
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

  const grouped = new Map<string, CatalogProduct[]>();
  for (const product of products) {
    const list = grouped.get(product.category.name) ?? [];
    list.push(product);
    grouped.set(product.category.name, list);
  }
  const extraNames = [...grouped.keys()].filter(
    (name) => !STORE_CATEGORIES.includes(name as (typeof STORE_CATEGORIES)[number]),
  );
  const rails = [...STORE_CATEGORIES, ...extraNames].map((name) => ({
    name,
    slug: categorySlug(name),
    products: grouped.get(name) ?? [],
  }));
  const selected =
    rails.find((rail) => rail.slug === categoryParam) ??
    rails.find((rail) => rail.products.length > 0) ??
    rails[0];

  return (
    <div>
      <PageHeader
        title="Distribution Center"
        subtitle="Swipe categories left to right, then open a product to set On Shelf or Listed on the same SKU."
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
        <div className="space-y-5">
          <div className="sticky top-14 z-10 -mx-4 bg-background px-4 py-2 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Categories</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {rails.map((rail) => {
                const active = rail.slug === selected.slug;
                return (
                  <Link
                    key={rail.slug}
                    href={`/distribution?category=${rail.slug}`}
                    className={
                      active
                        ? "shrink-0 rounded-full bg-ink px-3 py-2 text-xs font-semibold whitespace-nowrap text-white"
                        : "shrink-0 rounded-full bg-soft px-3 py-2 text-xs font-medium whitespace-nowrap text-ink hover:bg-accent-soft"
                    }
                  >
                    {rail.name} ({rail.products.length})
                  </Link>
                );
              })}
            </div>
          </div>

          <section id={`category-${selected.slug}`} className="scroll-mt-28">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-ink">{selected.name}</h3>
                <p className="text-sm text-muted">{selected.products.length} products in this category</p>
              </div>
            </div>
            {selected.products.length === 0 ? (
              <Card>
                <Empty title="No products in this category" body="Other categories are in the row above." />
              </Card>
            ) : (
              <>
                <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
                  {selected.products.map((product) => (
                    <ShelfCard key={`shelf-${product.id}`} product={product} categoryKey={selected.slug} />
                  ))}
                </div>
                <div className="space-y-4">
                  {selected.products.map((product) => (
                    <ProductCard key={product.id} product={product} categoryKey={selected.slug} />
                  ))}
                </div>
              </>
            )}
          </section>
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
                  const categoryKey = categorySlug(
                    products.find((product) => product.id === item.productId)?.category.name ?? selected.slug,
                  );
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
                        returnTo={listingReturn(categoryKey, item.productId)}
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
