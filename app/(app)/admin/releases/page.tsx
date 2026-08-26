import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { money } from "@/lib/utils";
import { PAYMENT_RELEASE_STATUS } from "@/lib/labels";
import { processDueReleases } from "@/lib/process-releases";
import { schedulePaymentRelease } from "@/lib/actions/admin";
import { Button, Card, PageHeader, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

const ERRORS: Record<string, string> = {
  invalid: "Select an order.",
  hours: "Release delay must be between 0 and 168 hours.",
  order: "Order not found.",
  status: "That order is not waiting on a payment release.",
  exists: "A release is already scheduled for that order.",
  amount: "This order has no merchant proceeds to release.",
};

export default async function PaymentReleasePage({
  searchParams,
}: {
  searchParams: Promise<{ scheduled?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  await processDueReleases();
  const { scheduled, error } = await searchParams;

  const [eligible, scheduledRows, released] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
        walletReleased: false,
        paymentRelease: null,
        profit: { gt: 0 },
      },
      include: { merchant: true, customer: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.paymentRelease.findMany({
      where: { status: "SCHEDULED" },
      include: { order: { include: { merchant: true } } },
      orderBy: { releaseAt: "asc" },
    }),
    prisma.paymentRelease.findMany({
      where: { status: "RELEASED" },
      include: { order: { include: { merchant: true } } },
      orderBy: { releasedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Payment release"
        subtitle="Schedule accepted-order proceeds to move from pending to available after a delay. The job runs automatically."
      />
      {scheduled ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Release scheduled. The amount posts to the store wallet when the timer completes.
        </p>
      ) : null}
      {error && ERRORS[error] ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[error]}</p>
      ) : null}

      <Card className="mb-6">
        <div className="px-5 py-4 font-medium">Pending — accepted orders without a schedule</div>
        {eligible.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No accepted orders are waiting for a release.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Store</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Release</Th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((order) => (
                <tr key={order.id}>
                  <Td>
                    {order.orderNumber}
                    <p className="text-xs text-muted">{order.customer.name}</p>
                  </Td>
                  <Td>{order.merchant.name}</Td>
                  <Td>
                    <StatusBadge value="PENDING" labels={PAYMENT_RELEASE_STATUS} />
                  </Td>
                  <Td>{money(order.profit)}</Td>
                  <Td>
                    <form action={schedulePaymentRelease} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input
                        name="hours"
                        type="number"
                        min={0}
                        max={168}
                        step="0.25"
                        defaultValue={24}
                        className="h-9 w-20 rounded-lg border border-line px-2 text-sm"
                        aria-label="Hours until release"
                      />
                      <span className="text-xs text-muted">hours</span>
                      <Button type="submit">Start timer</Button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card className="mb-6">
        <div className="px-5 py-4 font-medium">Scheduled</div>
        {scheduledRows.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No timers running.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Store</Th>
                <Th>Amount</Th>
                <Th>Releases at</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {scheduledRows.map((row) => (
                <tr key={row.id}>
                  <Td>{row.order.orderNumber}</Td>
                  <Td>{row.order.merchant.name}</Td>
                  <Td>{money(row.amount)}</Td>
                  <Td>{format(row.releaseAt, "MMM d, yyyy HH:mm")}</Td>
                  <Td>
                    <StatusBadge value={row.status} labels={PAYMENT_RELEASE_STATUS} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 font-medium">Released</div>
        {released.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No releases have posted yet.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Store</Th>
                <Th>Amount</Th>
                <Th>Released</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {released.map((row) => (
                <tr key={row.id}>
                  <Td>{row.order.orderNumber}</Td>
                  <Td>{row.order.merchant.name}</Td>
                  <Td>{money(row.amount)}</Td>
                  <Td>{row.releasedAt ? format(row.releasedAt, "MMM d, yyyy HH:mm") : "—"}</Td>
                  <Td>
                    <StatusBadge value={row.status} labels={PAYMENT_RELEASE_STATUS} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
