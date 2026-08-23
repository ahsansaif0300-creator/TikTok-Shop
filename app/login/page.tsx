import { Anchor } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#161310] text-[#efe8db] lg:flex lg:flex-col lg:justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent text-white">
            <Anchor className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Harbor</p>
            <p className="text-xs text-[#b7aa98]">Commerce operations</p>
          </div>
        </div>
        <div className="max-w-md space-y-5">
          <p className="text-sm uppercase tracking-[0.2em] text-accent">Multi-merchant OS</p>
          <h1 className="text-4xl font-semibold leading-tight">
            Run a real marketplace without the carnival tricks.
          </h1>
          <p className="text-[#cbbfae]">
            Orders, catalog, refunds, shipping, and bank payouts — with roles, audit history, and
            balances that come from actual sales.
          </p>
        </div>
        <ul className="grid max-w-lg grid-cols-2 gap-3 text-sm text-[#d8ccba]">
          <li className="rounded-2xl border border-white/10 bg-white/5 p-4">Seller onboarding & plans</li>
          <li className="rounded-2xl border border-white/10 bg-white/5 p-4">Fulfillment & carriers</li>
          <li className="rounded-2xl border border-white/10 bg-white/5 p-4">Refunds with restock</li>
          <li className="rounded-2xl border border-white/10 bg-white/5 p-4">Ledger + bank payouts</li>
        </ul>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-line bg-card p-8 shadow-[0_20px_50px_rgba(28,25,21,0.06)]">
          <h2 className="text-2xl font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Use a demo workspace account to explore Harbor.</p>
          {error === "setup" ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
              Harbor could not open the workspace database. In Hostinger, set{" "}
              <code>DATABASE_URL=file:./dev.db</code> and a real <code>AUTH_SECRET</code>, then
              Redeploy. Check Runtime logs if it still fails.
            </p>
          ) : error ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
              Email or password is incorrect.
            </p>
          ) : null}
          <form action={loginAction} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email</span>
              <input
                name="email"
                type="email"
                required
                defaultValue="oscar.d@example.net"
                className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Password</span>
              <input
                name="password"
                type="password"
                required
                defaultValue="HarborAdmin!2026"
                className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
              />
            </label>
            <button className="h-11 w-full rounded-xl bg-accent text-sm font-medium text-white hover:bg-[#0c6a5e]">
              Continue
            </button>
          </form>
          <div className="mt-6 space-y-1 rounded-2xl bg-[#f6f1e8] p-4 text-xs text-muted">
            <p>
              <span className="font-medium text-ink">Admin</span> oscar.d@example.net / HarborAdmin!2026
            </p>
            <p>
              <span className="font-medium text-ink">Ops</span> sarah.b@example.net / HarborOps!2026
            </p>
            <p>
              <span className="font-medium text-ink">Merchant</span> iris.p@example.org /
              HarborMerchant!2026
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
