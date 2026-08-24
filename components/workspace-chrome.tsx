"use client";

import { useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { initials } from "@/lib/utils";
import { SidebarNav } from "@/components/sidebar-nav";
import { BrandBar, HarborMark } from "@/components/brand";
import { MerchantTabBar } from "@/components/merchant-tab-bar";
import { CopyShopLink } from "@/components/copy-shop-link";
import type { Role } from "@prisma/client";

export function WorkspaceChrome({
  role,
  name,
  roleLabel,
  unread,
  storeName,
  shopUrl,
  children,
}: {
  role: Role;
  name: string;
  roleLabel: string;
  unread: number;
  storeName: string | null;
  shopUrl: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const merchant = role === "MERCHANT";
  const contextLabel = storeName ?? "All merchants";
  const nav = <SidebarNav role={role} unread={unread} onNavigate={close} />;

  const brand = (
    <div className="flex h-16 items-center px-5">
      <HarborMark light compact />
    </div>
  );

  return (
    <div className={merchant ? "min-h-screen lg:grid lg:grid-cols-[240px_1fr]" : "min-h-screen lg:grid lg:grid-cols-[260px_1fr]"}>
      <aside className="hidden min-h-screen bg-sidebar text-white lg:block">
        <BrandBar />
        {brand}
        {nav}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/45" aria-label="Close menu" onClick={close} />
          <aside className="relative h-full w-[min(280px,86vw)] overflow-y-auto bg-sidebar text-white shadow-xl">
            <BrandBar />
            <div className="flex items-center justify-between pr-2">
              {brand}
              <button
                type="button"
                className="mr-3 grid size-9 place-items-center rounded-xl text-white hover:bg-white/10"
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
        {merchant ? (
          <header className="sticky top-0 z-20 bg-sidebar text-white">
            <BrandBar />
            <div className="flex h-14 items-center justify-between gap-3 px-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-xl bg-white/10 text-white lg:hidden"
                  aria-label="Open menu"
                  onClick={() => setOpen(true)}
                >
                  <Menu className="size-4" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{contextLabel}</p>
                  {shopUrl ? <p className="truncate text-[11px] text-white/55">{shopUrl.replace(/^https?:\/\//, "")}</p> : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="grid size-8 place-items-center rounded-full bg-accent text-[11px] font-semibold">
                  {initials(name)}
                </div>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="grid size-9 place-items-center rounded-xl bg-white/10 text-white"
                    title="Sign out"
                  >
                    <LogOut className="size-4" />
                  </button>
                </form>
              </div>
            </div>
          </header>
        ) : (
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
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
                <p className="hidden text-xs text-muted sm:block">Real orders, catalog, settlements, and bank payouts.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-ink">{name}</p>
                <p className="text-[11px] text-muted">{roleLabel}</p>
              </div>
              <div className="grid size-9 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
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
        )}
        <main className={merchant ? "px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8" : "px-4 py-6 sm:px-6 lg:px-8"}>
          {merchant && shopUrl ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-3 py-2 lg:hidden">
              <p className="truncate font-mono text-[11px] text-muted">{shopUrl}</p>
              <CopyShopLink url={shopUrl} />
            </div>
          ) : null}
          {children}
        </main>
        {merchant ? <MerchantTabBar /> : null}
      </div>
    </div>
  );
}
