import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/labels";
import { Card, PageHeader, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!isStaff(session.role)) redirect("/");
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { orders: { include: { merchant: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!customer) notFound();

  return (
    <div>
      <PageHeader title={customer.name} subtitle={`${customer.email} · ${customer.phone}`} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-5 text-sm">
          <h2 className="font-medium">Address</h2>
          <p className="mt-2 text-muted">
            {customer.address}
            <br />
            {customer.city}, {customer.country}
          </p>
        </Card>
        <Card>
          <div className="px-5 py-4 font-medium">Orders</div>
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Merchant</Th>
                <Th>Status</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((order) => (
                <tr key={order.id}>
                  <Td>
                    <Link href={`/orders/${order.id}`} className="text-accent hover:underline">
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted">{format(order.createdAt, "MMM d, yyyy")}</p>
                  </Td>
                  <Td>{order.merchant.name}</Td>
                  <Td>
                    <StatusBadge value={order.status} labels={ORDER_STATUS} />
                  </Td>
                  <Td>{money(order.total)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      </div>
    </div>
  );
}
