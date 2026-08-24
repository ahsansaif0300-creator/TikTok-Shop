import Link from "next/link";
import { signupMerchantAction } from "@/lib/actions/signup";
import { AuthFrame } from "@/components/auth-frame";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    error === "email"
      ? "That email already has a Harbor login."
      : error === "password"
        ? "Password must be at least 8 characters."
        : error === "mismatch"
          ? "Password and confirmation do not match."
          : error === "setup"
            ? "Harbor could not create a shop right now. Try again after the database is ready."
            : error === "invalid"
              ? "Fill in shop name, your name, email, password, and country."
              : null;

  return (
    <AuthFrame
      title="Create a Harbor shop"
      subtitle="You get a unique shop link and a seller login to manage products, orders, and payouts."
      footer={
        <>
          Already selling on Harbor?{" "}
          <Link href="/login" className="font-medium text-cyan hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {message ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</p> : null}
      <form action={signupMerchantAction} className="mt-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Shop name</span>
          <input
            name="storeName"
            required
            placeholder="Northline Outfitters"
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Your name</span>
          <input
            name="contactName"
            required
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Confirm password</span>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Phone</span>
          <input
            name="phone"
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Country</span>
            <input
              name="country"
              required
              placeholder="United States"
              className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">City</span>
            <input
              name="city"
              className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
          </label>
        </div>
        <button className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-white hover:bg-[#e11d48]">
          Create shop
        </button>
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
