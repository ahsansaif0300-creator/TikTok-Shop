import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { money } from "@/lib/utils";
import { listedCatalogWhere } from "@/lib/product-listing";
import { placeStaffOrder } from "@/lib/actions/admin";
import { Button, Card, PageHeader, SearchForm } from "@/components/ui";
import { ProductThumb } from "@/components/product-thumb";

const ERRORS: Record<string, string> = {
  invalid: "Select a store, product, and customer.",
  qty: "Quantity must be a whole number between 1 and 99.",
  store: "That store is missing or suspended.",
  product: "Choose a Listed product that belongs to the selected store.",
  customer: "Choose a customer from the list.",
  stock: "Not enough stock for that quantity.",
  time: "Order time is invalid.",
};

export default async function OrderSenderPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; merchantId?: string; productId?: string; placed?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const { q = "", merchantId = "", productId = "", placed, error } = await searchParams;
  const stores = await prisma.merchant.findMany({
    where: {
      status: { not: "SUSPENDED" },
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { slug: { contains: q } },
              { city: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 40,
  });
  const selected = merchantId
    ? (stores.find((store) => store.id === merchantId) ??
      (await prisma.merchant.findUnique({ where: { id: merchantId } })))
    : null;
  const products = selected
    ? await prisma.product.findMany({
        where: { merchantId: selected.id, ...listedCatalogWhere },
        include: { category: true },
        orderBy: { title: "asc" },
      })
    : [];
  const chosen = products.find((product) => product.id === productId) ?? products[0] ?? null;
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const defaultTime = new Date();
  defaultTime.setMinutes(defaultTime.getMinutes() - defaultTime.getTimezoneOffset());
  const timeValue = defaultTime.toISOString().slice(0, 16);
  const storeQuery = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <div>
      <PageHeader
        title="Order Sender"
        subtitle="Search a store, then send an order using that store’s Listed products from Distribution Center. Same product records — no copies."
      />
      {placed ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Order {placed} was placed and is visible in the store backend.
        </p>
      ) : null}
      {error && ERRORS[error] ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[error]}</p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="font-medium">Search Store</h2>
          <p className="mt-1 text-sm text-muted">All available stores are listed. Search by name, email, slug, or city.</p>
          <div className="mt-3">
            <SearchForm placeholder="Search Store" defaultValue={q} />
          </div>
          <ul className="mt-4 max-h-96 space-y-1 overflow-auto text-sm">
            {stores.length === 0 ? (
              <li className="px-3 py-2 text-muted">No stores match that search.</li>
            ) : (
              stores.map((store) => (
                <li key={store.id}>
                  <Link
                    href={`/admin/place-order?merchantId=${store.id}${storeQuery}`}
                    className={`block rounded-xl px-3 py-2 ${store.id === selected?.id ? "bg-accent text-white" : "hover:bg-soft"}`}
                  >
                    <p className="font-medium">{store.name}</p>
                    <p className={store.id === selected?.id ? "text-white/80" : "text-xs text-muted"}>
                      {store.city}, {store.country}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Card>
        <div className="space-y-4">
          {!selected ? (
            <Card className="p-5">
              <p className="text-sm text-muted">Select a store to see its Listed products.</p>
            </Card>
          ) : products.length === 0 ? (
            <Card className="p-5">
              <p className="text-sm text-muted">
                {selected.name} has no Listed products. Mark SKUs as Listed in Distribution Center — this screen reads the
                same product records.
              </p>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted">
                Listed products for <span className="font-medium text-ink">{selected.name}</span>
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {products.map((product) => {
                  const active = chosen?.id === product.id;
                  return (
                    <Link
                      key={product.id}
                      href={`/admin/place-order?merchantId=${selected.id}&productId=${product.id}${storeQuery}`}
                      className={`rounded-2xl border p-4 ${active ? "border-accent bg-accent-soft" : "border-line bg-card hover:bg-soft"}`}
                    >
                      <div className="flex items-start gap-3">
                        <ProductThumb src={product.image} alt={product.title} size={64} />
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{product.title}</p>
                          <p className="text-xs text-muted">
                            {product.sku} · {product.category.name} · stock {product.stock}
                          </p>
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-white px-2 py-2">
                          <dt className="text-[11px] uppercase tracking-wide text-muted">Cost price</dt>
                          <dd className="mt-1 font-medium">{money(product.cost)}</dd>
                        </div>
                        <div className="rounded-lg bg-white px-2 py-2">
                          <dt className="text-[11px] uppercase tracking-wide text-muted">Total price</dt>
                          <dd className="mt-1 font-medium">{money(product.price)}</dd>
                        </div>
                      </dl>
                    </Link>
                  );
                })}
              </div>
              {chosen && customers.length > 0 ? (
                <Card className="p-5">
                  <form action={placeStaffOrder} className="space-y-4">
                    <input type="hidden" name="merchantId" value={selected.id} />
                    <input type="hidden" name="productId" value={chosen.id} />
                    <h2 className="font-medium">Send {chosen.title}</h2>
                    <p className="text-sm text-muted">
                      Cost {money(chosen.cost)} · selling {money(chosen.price)} · stock {chosen.stock}
                    </p>
                    <label className="block space-y-1.5 text-sm">
                      <span className="font-medium">Quantity</span>
                      <input
                        name="quantity"
                        type="number"
                        min={1}
                        max={99}
                        defaultValue={1}
                        required
                        className="h-11 w-full rounded-xl border border-line px-3"
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm">
                      <span className="font-medium">Order time</span>
                      <input
                        name="orderTime"
                        type="datetime-local"
                        required
                        defaultValue={timeValue}
                        className="h-11 w-full rounded-xl border border-line px-3"
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm">
                      <span className="font-medium">Customer (demo names)</span>
                      <select name="customerId" required className="h-11 w-full rounded-xl border border-line bg-white px-3">
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} · {customer.city}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit">Confirm and send order</Button>
                  </form>
                </Card>
              ) : customers.length === 0 ? (
                <Card className="p-5">
                  <p className="text-sm text-muted">No demo customers are in the database.</p>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
