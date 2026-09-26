import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { LOGIN } from "@/lib/access";
import { buildStamp } from "@/lib/build-stamp";
import { BRAND_NAME } from "@/lib/brand-name";

export const dynamic = "force-dynamic";

export default function WelcomePage() {
  const stamp = buildStamp();
  return (
    <AuthFrame
      title={BRAND_NAME}
      subtitle="Real shops, orders, and bank payouts for your own stores. Independent platform — not TikTok. Pick the door that matches your account."
      footer={
        <>
          Public shop pages live at <span className="font-mono text-white/90">/s/your-shop</span>
          <span className="mt-2 block font-mono text-[10px] text-white/40">Release {stamp}</span>
        </>
      }
    >
      <div className="mt-6 space-y-3">
        <Link
          href="/signup"
          className="grid h-11 place-items-center rounded-xl bg-accent text-sm font-semibold text-white hover:bg-[#9f1840]"
        >
          Create a store
        </Link>
        <Link
          href={LOGIN.store}
          className="grid h-11 place-items-center rounded-xl border border-line text-sm font-semibold hover:bg-soft"
        >
          Store Login
        </Link>
        <Link
          href={LOGIN.ops}
          className="grid h-11 place-items-center rounded-xl border border-line text-sm font-semibold hover:bg-soft"
        >
          Normal Backend Login
        </Link>
        <Link
          href={LOGIN.admin}
          className="grid h-11 place-items-center rounded-xl border border-line text-sm font-semibold hover:bg-soft"
        >
          Super Admin Login
        </Link>
      </div>
    </AuthFrame>
  );
}
