import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { money } from "@/lib/utils";
import { addStoreFunds } from "@/lib/actions/admin";
import { Button, Card, PageHeader, SearchForm } from "@/components/ui";

const ERRORS: Record<string, string> = {
  store: "Select a store first.",
  amount: "Enter an amount greater than zero.",
};

export default async function AddFundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; merchantId?: string; added?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const { q = "", merchantId = "", added, error } = await searchParams;
  const stores = await prisma.merchant.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { slug: { contains: q } },
            { city: { contains: q } },
          ],
        }
      : {},
    orderBy: { name: "asc" },
  });
  const selected = merchantId ? await prisma.merchant.findUnique({ where: { id: merchantId } }) : null;

  return (
    <div>
      <PageHeader
        title="Add funds"
        subtitle="Credit a store’s available balance immediately. A ledger row is written for the adjustment."
      />
      {added && selected ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Funds were added to {selected.name}. Available balance is now {money(selected.availableBalance)}.
        </p>
      ) : null}
      {error && ERRORS[error] ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[error]}</p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="font-medium">Search store</h2>
          <div className="mt-3">
            <SearchForm placeholder="Store name or email" defaultValue={q} />
          </div>
          <ul className="mt-4 max-h-96 space-y-1 overflow-auto text-sm">
            {stores.map((store) => (
              <li key={store.id}>
                <Link
                  href={`/admin/funds?merchantId=${store.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={`block rounded-xl px-3 py-2 ${store.id === selected?.id ? "bg-accent text-white" : "hover:bg-soft"}`}
                >
                  <p className="font-medium">{store.name}</p>
                  <p className={store.id === selected?.id ? "text-white/80" : "text-xs text-muted"}>
                    Available {money(store.availableBalance)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          {!selected ? (
            <p className="text-sm text-muted">Select a store, then enter the amount to add.</p>
          ) : (
            <form action={addStoreFunds} className="max-w-md space-y-4">
              <input type="hidden" name="merchantId" value={selected.id} />
              <h2 className="font-medium">{selected.name}</h2>
              <p className="text-sm text-muted">
                Available {money(selected.availableBalance)} · Pending {money(selected.pendingBalance)}
              </p>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Amount</span>
                <input
                  name="amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  className="h-11 w-full rounded-xl border border-line px-3"
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Note (optional)</span>
                <input name="note" className="h-11 w-full rounded-xl border border-line px-3" />
              </label>
              <Button type="submit">Add funds</Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
