import type { ReactNode } from "react";
import Link from "next/link";
import { HarborMark } from "@/components/brand";
import { logoutSupportAction } from "@/lib/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { displayStaffName } from "@/lib/staff-display";

export function SupportDeskChrome({
  session,
  children,
}: {
  session: SessionUser;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-soft">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-sidebar px-4 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <HarborMark light compact />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Support Desk</p>
            <p className="truncate text-[11px] text-white/60">Store chats · reply in the same screen</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          {session.role === "SUPER_ADMIN" ? (
            <Link href="/" className="hidden rounded-lg px-3 py-1.5 text-white/80 hover:bg-white/10 sm:inline">
              Main Backend
            </Link>
          ) : (
            <Link href="/" className="hidden rounded-lg px-3 py-1.5 text-white/80 hover:bg-white/10 sm:inline">
              Operations
            </Link>
          )}
          <span className="hidden max-w-[180px] truncate text-xs text-white/70 sm:inline">
            {displayStaffName(session)}
          </span>
          <form action={logoutSupportAction}>
            <button type="submit" className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/15">
              Logout
            </button>
          </form>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_1fr]">{children}</div>
    </div>
  );
}
