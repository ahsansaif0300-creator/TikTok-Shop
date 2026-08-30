import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { requestPayout } from "@/lib/actions/payouts";
import { money } from "@/lib/utils";
import { PAYOUT_STATUS } from "@/lib/labels";
import { Button, Card, Empty, Field, PageHeader, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

const ERRORS: Record<string, string> = {
  balance: "Insufficient Balance. The requested amount is not available.",
  invalid: "Enter a withdrawal amount greater than zero.",
  details: "Full name, bank name, and bank account number are required.",
  forbidden: "You cannot request a withdrawal for that store.",
};

export default async function WithdrawPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; requested?: string }>;
}) {
  const session = await requireMerchant();
  const { error, requested } = await searchParams;
  const [store, payouts] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: session.merchantId } }),
    prisma.payout.findMany({
      where: { merchantId: session.merchantId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Withdrawal"
        subtitle="Request a bank transfer from your available sales balance. Operations reviews the request before money is sent."
      />
      {error && ERRORS[error] ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[error]}</p>
      ) : null}
      {requested ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Withdrawal request submitted as Pending. Super admin and operations can approve or reject it from Payouts.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="font-medium">New withdrawal</h2>
          <p className="mt-1 text-sm text-muted">Available: {money(store?.availableBalance ?? 0)}</p>
          <form action={requestPayout} className="mt-4 space-y-3">
            <input type="hidden" name="returnTo" value="withdraw" />
            <Field name="accountHolder" label="Full name" defaultValue={session.name} required />
            <Field name="bankName" label="Bank name" defaultValue={store?.bankName ?? ""} required />
            <Field name="accountNumber" label="Bank account number" required />
            <Field name="amount" label="Amount" type="number" required />
            <Button type="submit">Submit withdrawal</Button>
          </form>
        </Card>
        <Card>
          {payouts.length === 0 ? (
            <Empty title="No withdrawal requests" body="Submitted requests stay visible here with their status." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Request</Th>
                  <Th>Bank</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <Td>
                      {payout.payoutNumber}
                      <p className="text-xs text-muted">{format(payout.createdAt, "MMM d, yyyy")}</p>
                      {payout.accountHolder ? <p className="text-xs text-muted">{payout.accountHolder}</p> : null}
                    </Td>
                    <Td>
                      {payout.bankName}
                      <p className="text-xs text-muted">
                        {payout.accountNumber || `••••${payout.accountLast4}`}
                      </p>
                    </Td>
                    <Td>{money(payout.amount)}</Td>
                    <Td>
                      <StatusBadge value={payout.status} labels={PAYOUT_STATUS} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
