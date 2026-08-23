import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { SHIPMENT_STATUS } from "@/lib/labels";
import { trackingHref } from "@/lib/utils";
import { Card, Empty, PageHeader, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

export default async function ShippingPage() {
  const session = await requireSession();
  const scope = merchantScope(session);
  const [shipments, carriers, ready] = await Promise.all([
    prisma.shipment.findMany({
      where: { order: scope },
      include: { carrier: true, order: { include: { merchant: true, customer: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.carrier.findMany({ orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: {
        ...scope,
        status: { in: ["PAID", "PROCESSING"] },
        shipments: { none: {} },
      },
      include: { merchant: true, customer: true },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Shipping"
        subtitle="Ready-to-ship queue, then real carrier tracking. No synthetic transit timers."
      />
      <Card className="mb-6">
        <div className="px-5 py-4">
          <h2 className="font-medium">Ready to ship</h2>
          <p className="text-sm text-muted">Paid or processing orders that still need a tracking number.</p>
        </div>
        {ready.length === 0 ? (
          <Empty title="Caught up" body="Every paid order already has a shipment, or none are waiting." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Merchant</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {ready.map((order) => (
                <tr key={order.id} className="hover:bg-[#faf6ef]">
                  <Td>
                    <Link href={`/orders/${order.id}`} className="font-medium text-accent hover:underline">
                      {order.orderNumber}
                    </Link>
                  </Td>
                  <Td>{order.merchant.name}</Td>
                  <Td>{order.customer.name}</Td>
                  <Td>{order.status === "PAID" ? "Paid" : "Processing"}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {carriers.map((carrier) => (
          <Card key={carrier.id} className="p-4">
            <p className="font-medium">{carrier.name}</p>
            <p className="text-xs text-muted">
              {carrier.code} · {carrier.active ? "Active" : "Disabled"}
            </p>
          </Card>
        ))}
      </div>
      <Card>
        {shipments.length === 0 ? (
          <Empty title="No shipments" body="Ship an order from its detail page to create tracking." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Tracking</Th>
                <Th>Order</Th>
                <Th>Carrier</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Shipped</Th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <Td className="font-mono text-xs">
                    <a
                      href={trackingHref(shipment.carrier.trackingUrl, shipment.trackingNumber)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      {shipment.trackingNumber}
                    </a>
                  </Td>
                  <Td>
                    <Link href={`/orders/${shipment.orderId}`} className="text-accent hover:underline">
                      {shipment.order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted">{shipment.order.merchant.name}</p>
                  </Td>
                  <Td>{shipment.carrier.name}</Td>
                  <Td>{shipment.order.customer.name}</Td>
                  <Td>
                    <StatusBadge value={shipment.status} labels={SHIPMENT_STATUS} />
                  </Td>
                  <Td>{shipment.shippedAt ? format(shipment.shippedAt, "MMM d, yyyy") : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
