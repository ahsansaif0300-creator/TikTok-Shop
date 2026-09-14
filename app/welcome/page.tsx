import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { LOGIN } from "@/lib/access";

export default function WelcomePage() {
  return (
    <AuthFrame
      title="Harbor Commerce"
      subtitle="Real shops, orders, and bank payouts. Pick the door that matches your account — they are separate logins, not one shared form."
      footer={
        <>
          Public shop pages live at <span className="font-mono text-white/90">/s/your-shop</span>
        </>
      }
    >
      <div className="mt-6 space-y-3">
        <Link
          href="/signup"
          className="grid h-11 place-items-center rounded-xl bg-accent text-sm font-semibold text-white hover:bg-[#e11d48]"
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
