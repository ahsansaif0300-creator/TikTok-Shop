import type { ReactNode } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { RELEASE_LABEL } from "@/lib/build-stamp";

export function RoleLoginForm({
  title,
  subtitle,
  action,
  error,
  footer,
}: {
  title: string;
  subtitle: string;
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  footer?: ReactNode;
}) {
  return (
    <AuthFrame title={title} subtitle={subtitle} footer={footer}>
      {error && error !== "setup" ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Email or password is incorrect, or this account cannot use this login.
        </p>
      ) : null}
      <form action={action} className="mt-6 space-y-4" data-release={RELEASE_LABEL}>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Username / Email</span>
          <input
            name="email"
            type="text"
            required
            autoComplete="username"
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
            className="h-11 w-full rounded-xl border border-line px-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
        </label>
        <button className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-white hover:bg-[#e11d48]">
          Login
        </button>
      </form>
    </AuthFrame>
  );
}
