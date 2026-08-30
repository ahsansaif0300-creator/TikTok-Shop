import Link from "next/link";
import { format } from "date-fns";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { money } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/labels";
import { PickupDialog } from "@/components/pickup-dialog";
import { ProductThumb } from "@/components/product-thumb";
import { Card, Empty, PageHeader, SearchForm, StatusBadge, TableWrap, Tabs, Td, Th } from "@/components/ui";

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING_PAYMENT", label: "Unpaid" },
  { value: "PAID", label: "Paid" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const ERRORS: Record<string, string> = {
  balance: "Insufficient Balance",
  paypass: "Payment password is incorrect.",
  picked: "That order was already picked up.",
  invalid: "That order is not available to pick up.",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; error?: string; picked?: string; id?: string }>;
}) {
  const session = await requireSession();
  const { status = "", q = "", error, picked } = await searchParams;
  const merchant = session.role === "MERCHANT";
  const orders = await prisma.order.findMany({
    where: {
      ...merchantScope(session),
      ...(status ? { status: status as OrderStatus } : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q } },
              { customer: { name: { contains: q } } },
              { merchant: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { merchant: true, customer: true, items: true },
    orderBy: { createdAt: "desc" },
  });
  const pickupOrders = merchant
    ? orders.filter((order) => order.status === "PAID")
    : [];

  return (
    <div>
      <PageHeader title="Orders" subtitle="Legitimate order lifecycle from payment through settlement." />
      {error && ERRORS[error] ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[error]}</p>
      ) : null}
      {picked ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Order picked up. It is now processing and listed in Distribution Center.
        </p>
      ) : null}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs items={TABS} active={status} basePath="/orders" />
        <SearchForm placeholder="Search order, customer, merchant" defaultValue={q} />
      </div>
      {pickupOrders.length > 0 ? (
        <div className="mb-6 space-y-4">
          {pickupOrders.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">New order</p>
                  <Link href={`/orders/${order.id}`} className="text-lg font-semibold text-accent hover:underline">
                    {order.orderNumber}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {order.customer.name} · {format(order.createdAt, "MMM d, yyyy HH:mm")}
                  </p>
                </div>
                <StatusBadge value={order.status} labels={ORDER_STATUS} />
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-soft px-3 py-2">
                    <span className="flex min-w-0 items-center gap-3">
                      <ProductThumb src={item.image} alt={item.title} size={48} />
                      <span>
                        {item.title}
                        <span className="block text-xs text-muted">Qty {item.quantity}</span>
                      </span>
                    </span>
                    <span className="font-medium">{money(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  Order amount <span className="font-semibold">{money(order.total)}</span>
                </p>
                <PickupDialog orderId={order.id} orderNumber={order.orderNumber} amountLabel={money(order.total)} />
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      <Card>
        {orders.length === 0 ? (
          <Empty title="No orders" body="Try another status or search term." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Product</Th>
                <Th>Merchant</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th>Status</Th>
                <Th>Total</Th>
                <Th>Profit</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-soft">
                  <Td>
                    <Link href={`/orders/${order.id}`} className="font-medium text-accent hover:underline">
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted">{format(order.createdAt, "MMM d, yyyy HH:mm")}</p>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProductThumb src={order.items[0]?.image} alt={order.items[0]?.title ?? order.orderNumber} />
                      <span className="max-w-[160px] truncate text-sm">
                        {order.items[0]?.title ?? "—"}
                        {order.items.length > 1 ? ` +${order.items.length - 1}` : ""}
                      </span>
                    </div>
                  </Td>
                  <Td>{order.merchant.name}</Td>
                  <Td>
                    {order.customer.name}
                    <p className="text-xs text-muted">{order.customer.city}</p>
                  </Td>
                  <Td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</Td>
                  <Td>
                    <StatusBadge value={order.status} labels={ORDER_STATUS} />
                  </Td>
                  <Td>{money(order.total)}</Td>
                  <Td>{money(order.profit)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
