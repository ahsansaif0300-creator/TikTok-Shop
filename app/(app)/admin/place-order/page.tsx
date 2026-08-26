import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { money } from "@/lib/utils";
import { placeStaffOrder } from "@/lib/actions/admin";
import { Button, Card, PageHeader, SearchForm } from "@/components/ui";

const ERRORS: Record<string, string> = {
  invalid: "Select a store, product, and customer.",
  qty: "Quantity must be a whole number between 1 and 99.",
  store: "That store is missing or suspended.",
  product: "Choose an active product that belongs to the selected store.",
  customer: "Choose a customer from the list.",
  stock: "Not enough stock for that quantity.",
  time: "Order time is invalid.",
};

export default async function PlaceOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; merchantId?: string; placed?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const { q = "", merchantId = "", placed, error } = await searchParams;
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
  const selected = merchantId ? stores.find((store) => store.id === merchantId) ?? (await prisma.merchant.findUnique({ where: { id: merchantId } })) : null;
  const products = selected
    ? await prisma.product.findMany({
        where: { merchantId: selected.id, status: "ACTIVE" },
        orderBy: { title: "asc" },
      })
    : [];
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const defaultTime = new Date();
  defaultTime.setMinutes(defaultTime.getMinutes() - defaultTime.getTimezoneOffset());
  const timeValue = defaultTime.toISOString().slice(0, 16);

  return (
    <div>
      <PageHeader
        title="Place order"
        subtitle="Create a paid order on a store. It shows up in that store’s Orders list like any other sale."
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
          <h2 className="font-medium">1. Search store</h2>
          <div className="mt-3">
            <SearchForm placeholder="Store name, email, or city" defaultValue={q} />
          </div>
          <ul className="mt-4 max-h-96 space-y-1 overflow-auto text-sm">
            {stores.map((store) => (
              <li key={store.id}>
                <Link
                  href={`/admin/place-order?merchantId=${store.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={`block rounded-xl px-3 py-2 ${store.id === selected?.id ? "bg-accent text-white" : "hover:bg-soft"}`}
                >
                  <p className="font-medium">{store.name}</p>
                  <p className={store.id === selected?.id ? "text-white/80" : "text-xs text-muted"}>
                    {store.city}, {store.country}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          {!selected ? (
            <p className="text-sm text-muted">Select a store to see its catalog and place an order.</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted">{selected.name} has no active products yet.</p>
          ) : customers.length === 0 ? (
            <p className="text-sm text-muted">No demo customers are in the database.</p>
          ) : (
            <form action={placeStaffOrder} className="space-y-4">
              <input type="hidden" name="merchantId" value={selected.id} />
              <h2 className="font-medium">2. Product, time, and customer</h2>
              <p className="text-sm text-muted">
                Store: <span className="font-medium text-ink">{selected.name}</span>
              </p>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Product</span>
                <select name="productId" required className="h-11 w-full rounded-xl border border-line bg-white px-3">
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title} · {money(product.price)} · stock {product.stock}
                    </option>
                  ))}
                </select>
              </label>
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
              <Button type="submit">Confirm and place order</Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
