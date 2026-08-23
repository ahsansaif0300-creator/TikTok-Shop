import { format } from "date-fns";
import type { LedgerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { money } from "@/lib/utils";
import { LEDGER_TYPE } from "@/lib/labels";
import { Card, Empty, PageHeader, StatCard, StatusBadge, TableWrap, Tabs, Td, Th } from "@/components/ui";

const TABS = [
  { value: "", label: "All" },
  { value: "SALE", label: "Sales" },
  { value: "REFUND", label: "Refunds" },
  { value: "PAYOUT", label: "Payouts" },
  { value: "FEE", label: "Fees" },
  { value: "ADJUSTMENT", label: "Adjustments" },
];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await requireSession();
  const { type = "" } = await searchParams;
  const scope = merchantScope(session);
  const merchantView = session.role === "MERCHANT";
  const merchantFilter = merchantView && session.merchantId ? { id: session.merchantId } : {};

  const [merchants, entries] = await Promise.all([
    prisma.merchant.findMany({
      where: merchantFilter,
      select: { id: true, name: true, availableBalance: true, pendingBalance: true },
      orderBy: { name: "asc" },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        ...scope,
        ...(type ? { type: type as LedgerType } : {}),
      },
      include: { merchant: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  const available = merchants.reduce((sum, m) => sum + m.availableBalance, 0);
  const pending = merchants.reduce((sum, m) => sum + m.pendingBalance, 0);

  return (
    <div>
      <PageHeader
        title="Ledger"
        subtitle="Balances come from completed sales minus refunds and paid-out bank transfers. No investment wallets or crypto rails."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Available to payout" value={money(available)} />
        <StatCard label="Pending settlement" value={money(pending)} hint="Held until orders complete" />
      </div>
      <div className="mb-4">
        <Tabs items={TABS} active={type} basePath="/finance" paramName="type" />
      </div>
      <Card>
        {entries.length === 0 ? (
          <Empty title="No ledger activity" body="Settlements appear when orders are paid and completed." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                {merchantView ? null : <Th>Merchant</Th>}
                <Th>Type</Th>
                <Th>Reference</Th>
                <Th>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <Td>{format(entry.createdAt, "MMM d, yyyy HH:mm")}</Td>
                  {merchantView ? null : <Td>{entry.merchant.name}</Td>}
                  <Td>
                    <StatusBadge value={entry.type} labels={LEDGER_TYPE} />
                  </Td>
                  <Td>
                    <p className="font-mono text-xs">{entry.reference}</p>
                    <p className="text-xs text-muted">{entry.note}</p>
                  </Td>
                  <Td className={entry.amount < 0 ? "text-rose-700" : "text-emerald-800"}>
                    {money(entry.amount)}
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
