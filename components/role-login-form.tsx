import type { ReactNode } from "react";
import { AuthFrame } from "@/components/auth-frame";

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
      {error === "setup" ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          TikiTok Shop could not open the packed demo database. Redeploy the latest{" "}
          <code>main</code> branch, click Restart, then try again. Keep{" "}
          <code>AUTH_SECRET</code> set in Hostinger Environment variables.
        </p>
      ) : error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Email or password is incorrect, or this account cannot use this login.
        </p>
      ) : null}
      <form action={action} className="mt-6 space-y-4">
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
