"use client";

import { useState, type ReactNode } from "react";
import { Anchor, LogOut, Menu, X } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { initials } from "@/lib/utils";
import { SidebarNav } from "@/components/sidebar-nav";
import type { Role } from "@prisma/client";

export function WorkspaceChrome({
  role,
  name,
  roleLabel,
  unread,
  storeName,
  children,
}: {
  role: Role;
  name: string;
  roleLabel: string;
  unread: number;
  storeName: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const contextLabel = storeName ?? "All merchants";
  const nav = <SidebarNav role={role} unread={unread} onNavigate={close} />;

  const brand = (
    <div className="flex h-16 items-center gap-3 px-5">
      <div className="grid size-9 place-items-center rounded-xl bg-accent text-white">
        <Anchor className="size-4" />
      </div>
      <div>
        <p className="text-sm font-semibold tracking-wide">Harbor</p>
        <p className="text-[11px] text-[#b7aa98]">Commerce OS</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden min-h-screen bg-sidebar text-[#efe8db] lg:block">
        {brand}
        {nav}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close menu"
            onClick={close}
          />
          <aside className="relative h-full w-[min(280px,86vw)] overflow-y-auto bg-sidebar text-[#efe8db] shadow-xl">
            <div className="flex items-center justify-between pr-2">
              {brand}
              <button
                type="button"
                className="mr-3 grid size-9 place-items-center rounded-xl text-[#efe8db] hover:bg-[#2a241e]"
                aria-label="Close menu"
                onClick={close}
              >
                <X className="size-4" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-[#f4f1ea]/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-xl border border-line bg-white text-ink lg:hidden"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{contextLabel}</p>
              <p className="hidden text-xs text-muted sm:block">
                Real orders, catalog, settlements, and bank payouts.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-ink">{name}</p>
              <p className="text-[11px] text-muted">{roleLabel}</p>
            </div>
            <div className="grid size-9 place-items-center rounded-full bg-[#e7dcc8] text-xs font-semibold text-ink">
              {initials(name)}
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
