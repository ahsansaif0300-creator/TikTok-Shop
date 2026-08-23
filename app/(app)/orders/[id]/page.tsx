import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { canAccessMerchant } from "@/lib/scope";
import { money, trackingHref } from "@/lib/utils";
import { ORDER_STATUS, REFUND_STATUS, SHIPMENT_STATUS } from "@/lib/labels";
import { ORDER_BUTTON_ACTIONS, canOpenRefund } from "@/lib/order-flow";
import { addOrderNote, shipOrder, updateOrderStatus } from "@/lib/actions/orders";
import { createRefund } from "@/lib/actions/refunds";
import { Button, Card, Field, PageHeader, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

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
  const [carriers, logs] = await Promise.all([
    prisma.carrier.findMany({ where: { active: true } }),
    prisma.auditLog.findMany({
      where: { entity: "Order", entityId: order.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const actions = ORDER_BUTTON_ACTIONS[order.status] ?? [];
  const canShip = order.status === "PAID" || order.status === "PROCESSING";
  const refundable = canOpenRefund(order.status);
  const staff = isStaff(session.role);

  const timeline = [
    { label: "Placed", at: order.createdAt },
    { label: "Paid", at: order.paidAt },
    { label: "Shipped", at: order.shippedAt },
    { label: "Delivered", at: order.deliveredAt },
    { label: "Settled", at: order.completedAt },
  ];

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
          <Card className="p-5">
            <h2 className="font-medium">Lifecycle</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-5">
              {timeline.map((step) => (
                <li key={step.label} className="rounded-xl bg-[#f6f1e8] px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted">{step.label}</p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {step.at ? format(step.at, "MMM d, HH:mm") : "—"}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
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
          {canShip ? (
            <Card className="p-5">
              <h2 className="font-medium">Create shipment</h2>
              <p className="mt-1 text-sm text-muted">
                Shipping requires a carrier and tracking number. That is the only way an order becomes Shipped.
              </p>
              <form action={shipOrder} className="mt-4 grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="orderId" value={order.id} />
                <label className="space-y-1.5 text-sm">
                  <span>Carrier</span>
                  <select name="carrierId" required className="h-11 w-full rounded-xl border border-line bg-white px-3">
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
          ) : null}
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
          <Card className="space-y-2 p-5 text-sm">
            <h2 className="font-medium">Totals</h2>
            <Row label="Subtotal" value={money(order.subtotal)} />
            <Row label="Shipping" value={money(order.shippingFee)} />
            <Row label="Tax" value={money(order.tax)} />
            <Row label="Customer paid" value={money(order.total)} />
            <Row label="Cost of goods" value={money(order.cost)} />
            <Row
              label={`Platform fee (${(order.merchant.plan.commissionRate * 100).toFixed(0)}%)`}
              value={money(order.platformFee)}
            />
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
                  <a
                    href={trackingHref(shipment.carrier.trackingUrl, shipment.trackingNumber)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    {shipment.trackingNumber}
                  </a>
                  <p className="text-xs text-muted">
                    {SHIPMENT_STATUS[shipment.status] ?? shipment.status}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-medium">Open a refund</h2>
            {refundable ? (
              <form action={createRefund} className="mt-3 space-y-3">
                <input type="hidden" name="orderId" value={order.id} />
                <select name="type" className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">
                  <option value="REFUND_ONLY">Refund only</option>
                  <option value="RETURN_AND_REFUND">Return & refund</option>
                  <option value="EXCHANGE">Exchange</option>
                </select>
                <Field name="amount" label="Amount" type="number" defaultValue={order.total} required />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="restock" className="size-4 rounded border-line" defaultChecked />
                  Restock items if approved
                </label>
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
                {staff ? null : (
                  <p className="text-xs text-muted">Operations staff approve or reject refunds.</p>
                )}
              </form>
            ) : (
              <p className="mt-2 text-sm text-muted">Refunds are available after the order is paid.</p>
            )}
            {order.refunds.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm">
                {order.refunds.map((refund) => (
                  <li key={refund.id}>
                    <Link href="/refunds" className="text-accent hover:underline">
                      {refund.refundNumber}
                    </Link>{" "}
                    · {REFUND_STATUS[refund.status] ?? refund.status} · {money(refund.amount)}
                    {refund.restock ? " · restock" : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
          {logs.length > 0 ? (
            <Card className="p-5 text-sm">
              <h2 className="font-medium">Audit</h2>
              <ul className="mt-3 space-y-2">
                {logs.map((log) => (
                  <li key={log.id} className="rounded-xl bg-[#f6f1e8] px-3 py-2">
                    <p>{log.detail}</p>
                    <p className="text-xs text-muted">{format(log.createdAt, "MMM d, HH:mm")}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
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
