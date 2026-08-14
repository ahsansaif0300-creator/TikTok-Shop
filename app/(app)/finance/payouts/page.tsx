import { format } from "date-fns";
import type { PayoutStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { money } from "@/lib/utils";
import { PAYOUT_STATUS } from "@/lib/labels";
import { decidePayout, requestPayout } from "@/lib/actions/payouts";
import { Button, Card, Empty, Field, PageHeader, StatusBadge, TableWrap, Tabs, Td, Th } from "@/components/ui";

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "PAID", label: "Paid" },
  { value: "REJECTED", label: "Rejected" },
];

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const { status = "" } = await searchParams;
  const staff = isStaff(session.role);
  const [payouts, merchants] = await Promise.all([
    prisma.payout.findMany({
      where: {
        ...merchantScope(session),
        ...(status ? { status: status as PayoutStatus } : {}),
      },
      include: { merchant: true },
      orderBy: { createdAt: "desc" },
    }),
    staff
      ? prisma.merchant.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } })
      : prisma.merchant.findMany({ where: { id: session.merchantId ?? "" } }),
  ]);

  return (
    <div>
      <PageHeader title="Payouts" subtitle="Bank transfers of earned sales balances. Review, approve, then mark paid when the transfer is sent." />
      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4">
            <Tabs items={TABS} active={status} basePath="/finance/payouts" />
          </div>
          <Card>
            {payouts.length === 0 ? (
              <Empty title="No payouts" body="Request a payout from available balance." />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Payout</Th>
                    <Th>Merchant</Th>
                    <Th>Bank</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id}>
                      <Td>
                        {payout.payoutNumber}
                        <p className="text-xs text-muted">{format(payout.createdAt, "MMM d")}</p>
                      </Td>
                      <Td>{payout.merchant.name}</Td>
                      <Td>
                        {payout.bankName} •{payout.accountLast4}
                      </Td>
                      <Td>{money(payout.amount)}</Td>
                      <Td>
                        <StatusBadge value={payout.status} labels={PAYOUT_STATUS} />
                      </Td>
                      <Td>
                        {staff && payout.status === "PENDING" ? (
                          <div className="flex gap-2">
                            <form action={decidePayout.bind(null, payout.id, "APPROVED")}>
                              <Button type="submit">Approve</Button>
                            </form>
                            <form action={decidePayout.bind(null, payout.id, "REJECTED")}>
                              <Button type="submit" variant="danger">
                                Reject
                              </Button>
                            </form>
                          </div>
                        ) : null}
                        {staff && payout.status === "APPROVED" ? (
                          <form action={decidePayout.bind(null, payout.id, "PAID")}>
                            <Button type="submit">Mark paid</Button>
                          </form>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>
        <Card className="h-fit p-5">
          <h2 className="font-medium">Request payout</h2>
          <form action={requestPayout} className="mt-4 space-y-3">
            {staff ? (
              <label className="block space-y-1.5 text-sm">
                <span>Merchant</span>
                <select name="merchantId" className="h-11 w-full rounded-xl border border-line bg-white px-3">
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name} ({money(merchant.availableBalance)} avail.)
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Field name="amount" label="Amount" type="number" required />
            <Field name="note" label="Note" />
            <Button type="submit">Submit request</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
