import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { requestRecharge } from "@/lib/actions/support";
import { money } from "@/lib/utils";
import { Button, Card, Field, PageHeader } from "@/components/ui";

export default async function RechargePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const session = await requireMerchant();
  const { error, sent } = await searchParams;
  const store = await prisma.merchant.findUnique({
    where: { id: session.merchantId },
    select: { availableBalance: true, pendingBalance: true },
  });

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Recharge / Add funds"
        subtitle="Ask operations to credit this store. The form does not increase your balance by itself."
      />
      {error === "invalid" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Enter an amount greater than zero.</p>
      ) : null}
      {sent ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Request sent to Service. Current available balance is still {money(store?.availableBalance ?? 0)}.
        </p>
      ) : null}
      <Card className="p-5">
        <p className="text-sm text-muted">
          Available {money(store?.availableBalance ?? 0)} · Pending {money(store?.pendingBalance ?? 0)}
        </p>
        <form action={requestRecharge} className="mt-4 space-y-3">
          <Field name="amount" label="Requested amount" type="number" required />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Note</span>
            <textarea name="note" rows={3} className="w-full rounded-xl border border-line p-3 text-sm" />
          </label>
          <Button type="submit">Send recharge request</Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          Or message an agent directly in{" "}
          <Link href="/service" className="text-accent hover:underline">
            Service
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
