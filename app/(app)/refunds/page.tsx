import Link from "next/link";
import { format } from "date-fns";
import type { RefundStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { money } from "@/lib/utils";
import { REFUND_STATUS, REFUND_TYPE } from "@/lib/labels";
import { approveRefund, rejectRefund } from "@/lib/actions/refunds";
import { Button, Card, Empty, PageHeader, StatusBadge, TableWrap, Tabs, Td, Th } from "@/components/ui";

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
];

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const { status = "" } = await searchParams;
  const refunds = await prisma.refund.findMany({
    where: {
      ...(status ? { status: status as RefundStatus } : {}),
      order: merchantScope(session),
    },
    include: { order: { include: { merchant: true, customer: true } } },
    orderBy: { createdAt: "desc" },
  });
  const staff = isStaff(session.role);

  return (
    <div>
      <PageHeader title="Refunds" subtitle="Review returns against real orders. Approved refunds reverse merchant balances and can restock." />
      <div className="mb-4">
        <Tabs items={TABS} active={status} basePath="/refunds" />
      </div>
      <Card>
        {refunds.length === 0 ? (
          <Empty title="No refunds" body="Refund requests will appear here." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Refund</Th>
                <Th>Order</Th>
                <Th>Type</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <Td>
                    <p className="font-medium">{refund.refundNumber}</p>
                    <p className="text-xs text-muted">{refund.reason}</p>
                    {refund.restock ? <p className="text-xs text-muted">Restock on approve</p> : null}
                  </Td>
                  <Td>
                    <Link href={`/orders/${refund.orderId}`} className="text-accent hover:underline">
                      {refund.order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted">
                      {refund.order.customer.name}
                      {staff ? ` · ${refund.order.merchant.name}` : ""}
                    </p>
                  </Td>
                  <Td>{REFUND_TYPE[refund.type]}</Td>
                  <Td>{money(refund.amount)}</Td>
                  <Td>
                    <StatusBadge value={refund.status} labels={REFUND_STATUS} />
                    <p className="text-xs text-muted">{format(refund.createdAt, "MMM d")}</p>
                  </Td>
                  <Td>
                    {staff && refund.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <form action={approveRefund.bind(null, refund.id)}>
                          <Button type="submit">Approve</Button>
                        </form>
                        <form action={rejectRefund.bind(null, refund.id)}>
                          <Button type="submit" variant="danger">
                            Reject
                          </Button>
                        </form>
                      </div>
                    ) : !staff && refund.status === "PENDING" ? (
                      <p className="text-xs text-muted">Waiting on ops</p>
                    ) : null}
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
