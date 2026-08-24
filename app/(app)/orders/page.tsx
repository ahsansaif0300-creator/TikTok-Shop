import Link from "next/link";
import { format } from "date-fns";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { money } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/labels";
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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await requireSession();
  const { status = "", q = "" } = await searchParams;
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

  return (
    <div>
      <PageHeader title="Orders" subtitle="Legitimate order lifecycle from payment through settlement." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs items={TABS} active={status} basePath="/orders" />
        <SearchForm placeholder="Search order, customer, merchant" defaultValue={q} />
      </div>
      <Card>
        {orders.length === 0 ? (
          <Empty title="No orders" body="Try another status or search term." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
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
