import {
  Bell,
  BadgePercent,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  Package,
  Settings,
  Star,
  Store,
  Tags,
  Truck,
  Undo2,
  Users,
  UserRound,
  Wallet,
  ShoppingBag,
  Banknote,
  Timer,
  UserPlus,
  Megaphone,
  IdCard,
} from "lucide-react";
import type { Role } from "@prisma/client";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  staffOnly?: boolean;
  adminOnly?: boolean;
};

export const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Selling",
    items: [
      { href: "/orders", label: "Orders", icon: ClipboardList },
      { href: "/refunds", label: "Refunds", icon: Undo2 },
      { href: "/shipping", label: "Shipping", icon: Truck },
      { href: "/products", label: "Products", icon: Package },
      { href: "/categories", label: "Categories", icon: Tags, staffOnly: true },
      { href: "/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    title: "Partners",
    items: [
      { href: "/merchants", label: "Merchants", icon: Store, staffOnly: true },
      { href: "/merchants/applications", label: "Applications", icon: FileCheck2, staffOnly: true },
      { href: "/merchants/plans", label: "Seller plans", icon: BadgePercent, staffOnly: true },
      { href: "/customers", label: "Customers", icon: Users, staffOnly: true },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/finance", label: "Ledger", icon: CircleDollarSign },
      { href: "/finance/payouts", label: "Payouts", icon: Wallet },
    ],
  },
  {
    title: "Super admin",
    items: [
      { href: "/admin/place-order", label: "Place order", icon: ShoppingBag, adminOnly: true },
      { href: "/admin/funds", label: "Add funds", icon: Banknote, adminOnly: true },
      { href: "/admin/releases", label: "Payment release", icon: Timer, adminOnly: true },
      { href: "/admin/users", label: "Backend users", icon: UserPlus, adminOnly: true },
      { href: "/admin/broadcast", label: "Send notification", icon: Megaphone, adminOnly: true },
      { href: "/admin/stores", label: "Store records", icon: IdCard, adminOnly: true },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/users", label: "Team", icon: UserRound, adminOnly: true },
      { href: "/profile", label: "Profile", icon: UserRound },
      { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
    ],
  },
];

export function visibleNav(role: Role) {
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.adminOnly && role !== "SUPER_ADMIN") return false;
      if (item.staffOnly && role === "MERCHANT") return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}

export function navHrefs(role: Role) {
  return visibleNav(role).flatMap((group) => group.items.map((item) => item.href));
}

/** Prefer the longest matching item so /merchants does not stay active on /merchants/applications. */
export function isNavActive(pathname: string, href: string, allHrefs: string[]) {
  if (href === "/") return pathname === "/";
  const matches = pathname === href || pathname.startsWith(`${href}/`);
  if (!matches) return false;
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}
