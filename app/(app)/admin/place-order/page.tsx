import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { listedCatalogWhere } from "@/lib/product-listing";
import { OrderSenderBoard } from "@/components/order-sender-board";
import { PageHeader } from "@/components/ui";

const ERRORS: Record<string, string> = {
  invalid: "Select a store, product, and customer.",
  select: "Tick at least one product, or use Distribute All.",
  qty: "Quantity must be a whole number between 1 and 99.",
  store: "That store is missing or suspended.",
  product: "Choose Listed products that belong to the selected store.",
  customer: "Choose a customer from the list.",
  stock: "Not enough stock for that quantity on one of the selected products.",
  time: "Order time is invalid.",
};

export default async function OrderSenderPage({
  searchParams,
}: {
  searchParams: Promise<{ merchantId?: string; placed?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const { merchantId = "", placed, error } = await searchParams;
  const selected = merchantId
    ? await prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true, name: true, storeCode: true, city: true, country: true, status: true },
      })
    : null;
  const store =
    selected && selected.status !== "SUSPENDED"
      ? {
          id: selected.id,
          name: selected.name,
          storeCode: selected.storeCode,
          city: selected.city,
          country: selected.country,
        }
      : null;
  const products = store
    ? (
        await prisma.product.findMany({
          where: { merchantId: store.id, ...listedCatalogWhere },
          include: { category: true },
          orderBy: { title: "asc" },
        })
      ).map((product) => ({
        id: product.id,
        title: product.title,
        sku: product.sku,
        category: product.category.name,
        stock: product.stock,
        cost: product.cost,
        price: product.price,
        image: product.image,
      }))
    : [];
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });
  const defaultTime = new Date();
  defaultTime.setMinutes(defaultTime.getMinutes() - defaultTime.getTimezoneOffset());
  const timeValue = defaultTime.toISOString().slice(0, 16);
  const placedOrders = placed ? placed.split(",").filter(Boolean) : [];

  return (
    <div>
      <PageHeader
        title="Order Sender"
        subtitle="Search a store, tick Listed products, then Distribute. Quantity, time, and customer stay on the left."
      />
      {placedOrders.length === 1 ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Order {placedOrders[0]} was placed and is visible in the store backend.
        </p>
      ) : null}
      {placedOrders.length > 1 ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {placedOrders.length} orders were placed and are visible in the store backend.
        </p>
      ) : null}
      {error && ERRORS[error] ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[error]}</p>
      ) : null}
      <OrderSenderBoard key={store?.id ?? "none"} store={store} products={products} customers={customers} timeValue={timeValue} />
    </div>
  );
}
