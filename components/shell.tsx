import type { ReactNode } from "react";
import { Anchor, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initials } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/labels";
import { SidebarNav } from "@/components/sidebar-nav";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const unread = await prisma.notification.count({
    where: { userId: session.userId, read: false },
  });

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="bg-sidebar text-[#efe8db]">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="grid size-9 place-items-center rounded-xl bg-accent text-white">
            <Anchor className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">Harbor</p>
            <p className="text-[11px] text-[#b7aa98]">Commerce OS</p>
          </div>
        </div>
        <SidebarNav role={session.role} unread={unread} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-[#f4f1ea]/90 px-4 backdrop-blur sm:px-6">
          <p className="hidden text-sm text-muted md:block">
            Real orders, catalog, settlements, and bank payouts.
          </p>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-ink">{session.name}</p>
              <p className="text-[11px] text-muted">{ROLE_LABEL[session.role]}</p>
            </div>
            <div className="grid size-9 place-items-center rounded-full bg-[#e7dcc8] text-xs font-semibold text-ink">
              {initials(session.name)}
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="grid size-9 place-items-center rounded-xl border border-line bg-white text-muted hover:text-ink"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
