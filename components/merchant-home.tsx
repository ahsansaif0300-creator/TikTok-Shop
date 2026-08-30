import Link from "next/link";
import {
  Bell,
  ClipboardList,
  Headset,
  Landmark,
  Package,
  Settings,
  Star,
  Truck,
  Undo2,
  Warehouse,
} from "lucide-react";
import { money } from "@/lib/utils";
import { CopyShopLink } from "@/components/copy-shop-link";
import { Card } from "@/components/ui";

type Shortcut = {
  href: string;
  label: string;
  icon: typeof Package;
  tone: "accent" | "cyan" | "ink";
};

const SHORTCUTS: Shortcut[] = [
  { href: "/service", label: "Service", icon: Headset, tone: "accent" },
  { href: "/orders", label: "Orders", icon: ClipboardList, tone: "cyan" },
  { href: "/distribution", label: "Distribution", icon: Warehouse, tone: "ink" },
  { href: "/withdraw", label: "Withdraw", icon: Landmark, tone: "accent" },
  { href: "/products", label: "Products", icon: Package, tone: "cyan" },
  { href: "/shipping", label: "Shipping", icon: Truck, tone: "ink" },
  { href: "/refunds", label: "Refunds", icon: Undo2, tone: "accent" },
  { href: "/reviews", label: "Reviews", icon: Star, tone: "cyan" },
  { href: "/notifications", label: "Inbox", icon: Bell, tone: "ink" },
  { href: "/profile", label: "Profile", icon: Settings, tone: "accent" },
];

const TONE = {
  accent: "bg-accent text-white",
  cyan: "bg-cyan text-ink",
  ink: "bg-sidebar text-white",
};

export function MerchantHome({
  name,
  storeName,
  shopUrl,
  todayOrderCount,
  todaySales,
  availableBalance,
  pendingBalance,
  attention,
}: {
  name: string;
  storeName: string;
  shopUrl: string;
  todayOrderCount: number;
  todaySales: number;
  availableBalance: number;
  pendingBalance: number;
  attention: { href: string; label: string }[];
}) {
  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-muted">Store overview</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Hi, {name}</h1>
        <p className="mt-1 text-sm text-muted">{storeName} · catalog, orders, and bank balances from real sales.</p>
      </div>
      <div className="mb-4 hidden items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 lg:flex">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Shop link</p>
          <p className="truncate font-mono text-sm text-ink">{shopUrl}</p>
        </div>
        <CopyShopLink url={shopUrl} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-sidebar p-4 text-white">
          <p className="text-xs text-white/60">Today&apos;s orders</p>
          <p className="mt-2 text-2xl font-semibold">{todayOrderCount}</p>
        </div>
        <div className="rounded-2xl bg-accent p-4 text-white">
          <p className="text-xs text-white/80">Today&apos;s sales</p>
          <p className="mt-2 text-2xl font-semibold">{money(todaySales)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Available balance</p>
          <p className="mt-1 text-lg font-semibold text-ink">{money(availableBalance)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Pending balance</p>
          <p className="mt-1 text-lg font-semibold text-ink">{money(pendingBalance)}</p>
        </Card>
      </div>
      <Link
        href="/service"
        className="mt-4 flex items-center gap-3 rounded-2xl bg-accent px-4 py-4 text-white shadow-sm hover:bg-[#e11d48]"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
          <Headset className="size-6" />
        </span>
        <span>
          <span className="block text-base font-semibold">Service</span>
          <span className="block text-sm text-white/80">
            Contact support — assistant asks a few basics, then a team member joins.
          </span>
        </span>
      </Link>
      <div className="mt-5 grid grid-cols-4 gap-3">
        {SHORTCUTS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-2 text-center">
              <span className={`grid size-12 place-items-center rounded-2xl ${TONE[item.tone]}`}>
                <Icon className="size-5" />
              </span>
              <span className="text-[11px] font-medium text-ink">{item.label}</span>
            </Link>
          );
        })}
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-medium text-ink">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing waiting right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attention.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-xl bg-soft px-3 py-2 text-sm text-ink hover:bg-accent-soft"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
