import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccessMerchant } from "@/lib/scope";
import { money } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/labels";
import { addOrderNote, shipOrder, updateOrderStatus } from "@/lib/actions/orders";
import { createRefund } from "@/lib/actions/refunds";
import { Button, Card, Field, PageHeader, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }[]>> = {
  PENDING_PAYMENT: [
    { status: "PAID", label: "Mark paid" },
    { status: "CANCELLED", label: "Cancel" },
  ],
  PAID: [
    { status: "PROCESSING", label: "Start processing" },
    { status: "CANCELLED", label: "Cancel" },
  ],
  PROCESSING: [{ status: "CANCELLED", label: "Cancel" }],
  SHIPPED: [{ status: "DELIVERED", label: "Mark delivered" }],
  DELIVERED: [{ status: "COMPLETED", label: "Settle & complete" }],
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      merchant: { include: { plan: true } },
      customer: true,
      items: { include: { product: true } },
      shipments: { include: { carrier: true } },
      refunds: true,
    },
  });
  if (!order || !canAccessMerchant(session, order.merchantId)) notFound();
  const carriers = await prisma.carrier.findMany({ where: { active: true } });
  const actions = NEXT[order.status] ?? [];

  return (
    <div>
      <PageHeader
        title={order.orderNumber}
        subtitle={`${order.merchant.name} · ${format(order.createdAt, "MMM d, yyyy HH:mm")}`}
        actions={<StatusBadge value={order.status} labels={ORDER_STATUS} />}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {actions.map((action) => (
          <form key={action.status} action={updateOrderStatus.bind(null, order.id, action.status)}>
            <Button type="submit" variant={action.status === "CANCELLED" ? "danger" : "primary"}>
              {action.label}
            </Button>
          </form>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <Card>
            <div className="px-5 py-4 font-medium">Items</div>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th>Qty</Th>
                  <Th>Price</Th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      <Link href={`/products/${item.productId}`} className="hover:underline">
                        {item.title}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs">{item.sku}</Td>
                    <Td>{item.quantity}</Td>
                    <Td>{money(item.price * item.quantity)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
          {(order.status === "PAID" || order.status === "PROCESSING") && (
            <Card className="p-5">
              <h2 className="font-medium">Create shipment</h2>
              <form action={shipOrder} className="mt-4 grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="orderId" value={order.id} />
                <label className="space-y-1.5 text-sm">
                  <span>Carrier</span>
                  <select name="carrierId" className="h-11 w-full rounded-xl border border-line bg-white px-3">
                    {carriers.map((carrier) => (
                      <option key={carrier.id} value={carrier.id}>
                        {carrier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field name="trackingNumber" label="Tracking number" required />
                <div className="flex items-end">
                  <Button type="submit">Ship order</Button>
                </div>
              </form>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="font-medium">Internal note</h2>
            <form action={addOrderNote} className="mt-3 space-y-3">
              <input type="hidden" name="orderId" value={order.id} />
              <textarea
                name="notes"
                defaultValue={order.notes}
                rows={3}
                className="w-full rounded-xl border border-line p-3 text-sm outline-none ring-accent/30 focus:ring-2"
              />
              <Button type="submit" variant="secondary">
                Save note
              </Button>
            </form>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5 space-y-2 text-sm">
            <h2 className="font-medium">Totals</h2>
            <Row label="Subtotal" value={money(order.subtotal)} />
            <Row label="Shipping" value={money(order.shippingFee)} />
            <Row label="Tax" value={money(order.tax)} />
            <Row label="Customer paid" value={money(order.total)} />
            <Row label="Cost of goods" value={money(order.cost)} />
            <Row label={`Platform fee (${(order.merchant.plan.commissionRate * 100).toFixed(0)}%)`} value={money(order.platformFee)} />
            <Row label="Merchant profit" value={money(order.profit)} />
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="font-medium">Customer</h2>
            <p className="mt-2 font-medium">{order.customer.name}</p>
            <p className="text-muted">{order.customer.email}</p>
            <p className="mt-2 text-muted">
              {order.customer.address}, {order.customer.city}, {order.customer.country}
            </p>
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="font-medium">Shipments</h2>
            <div className="mt-3 space-y-3">
              {order.shipments.length === 0 ? <p className="text-muted">No shipment yet.</p> : null}
              {order.shipments.map((shipment) => (
                <div key={shipment.id} className="rounded-xl bg-[#f6f1e8] p-3">
                  <p className="font-medium">{shipment.carrier.name}</p>
                  <p className="font-mono text-xs">{shipment.trackingNumber}</p>
                  <p className="text-xs text-muted">{shipment.status.replace("_", " ")}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-medium">Open a refund</h2>
            <form action={createRefund} className="mt-3 space-y-3">
              <input type="hidden" name="orderId" value={order.id} />
              <select name="type" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">
                <option value="REFUND_ONLY">Refund only</option>
                <option value="RETURN_AND_REFUND">Return & refund</option>
                <option value="EXCHANGE">Exchange</option>
              </select>
              <textarea
                name="reason"
                required
                placeholder="Reason"
                className="w-full rounded-xl border border-line p-3 text-sm"
                rows={2}
              />
              <Button type="submit" variant="secondary">
                Submit refund request
              </Button>
            </form>
            {order.refunds.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm">
                {order.refunds.map((refund) => (
                  <li key={refund.id}>
                    <Link href="/refunds" className="text-accent hover:underline">
                      {refund.refundNumber}
                    </Link>{" "}
                    · {refund.status} · {money(refund.amount)}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
