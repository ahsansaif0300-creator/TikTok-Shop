import { loginAction } from "@/lib/actions/auth";
import { AuthFrame } from "@/components/auth-frame";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; shop?: string }>;
}) {
  const { error, shop } = await searchParams;
  const forShop = Boolean(shop);

  return (
    <AuthFrame
      title={forShop ? "Seller sign in" : "Sign in"}
      subtitle={
        forShop
          ? "Use the email and password for this Harbor shop to manage catalog, orders, and payouts."
          : "Merchants and staff use Harbor to run real shops — catalog, orders, and bank payouts."
      }
      footer={
        <>
          New seller?{" "}
          <Link href="/signup" className="font-medium text-cyan hover:underline">
            Create a shop
          </Link>
        </>
      }
    >
      {error === "setup" ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Harbor could not open the packed demo database. Redeploy the latest{" "}
          <code>main</code> branch, click Restart, then try again. Keep{" "}
          <code>AUTH_SECRET</code> set in Hostinger Environment variables.
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
            autoComplete="username"
            defaultValue={forShop ? "" : "oscar.d@example.net"}
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            defaultValue={forShop ? "" : "HarborAdmin!2026"}
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <button className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-white hover:bg-[#e11d48]">
          Continue
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Need an account?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Sign up
        </Link>
      </p>
      {forShop ? null : (
        <div className="mt-6 space-y-1 rounded-2xl bg-soft p-4 text-xs text-muted">
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
      )}
    </AuthFrame>
  );
}
