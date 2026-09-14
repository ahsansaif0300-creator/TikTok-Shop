import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { LOGIN } from "@/lib/access";

export default function LoginIndexPage() {
  return (
    <AuthFrame
      title="Harbor sign in"
      subtitle="Choose the login that matches your account. Each area has its own URL and only accepts that role."
    >
      <ul className="mt-6 space-y-3 text-sm">
        <li>
          <Link href={LOGIN.store} className="block rounded-xl bg-soft px-4 py-3 font-medium hover:bg-accent-soft">
            Store Login
          </Link>
        </li>
        <li>
          <Link href={LOGIN.ops} className="block rounded-xl bg-soft px-4 py-3 font-medium hover:bg-accent-soft">
            Normal Backend Login
          </Link>
        </li>
        <li>
          <Link href={LOGIN.admin} className="block rounded-xl bg-soft px-4 py-3 font-medium hover:bg-accent-soft">
            Super Admin Login
          </Link>
        </li>
      </ul>
      <p className="mt-4 text-center text-sm text-muted">
        Need a shop?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </AuthFrame>
  );
}
