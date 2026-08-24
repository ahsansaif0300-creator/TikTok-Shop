"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, visibleNav } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

export function SidebarNav({
  role,
  unread,
  onNavigate,
}: {
  role: Role;
  unread: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = visibleNav(role);
  const allHrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  return (
    <nav className="space-y-6 px-3 pb-8 pt-2">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">
            {group.title}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isNavActive(pathname, item.href, allHrefs);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                    active ? "bg-accent text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="size-4 opacity-90" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/notifications" && unread > 0 ? (
                    <span className="rounded-full bg-white/20 px-1.5 text-[10px] text-white">{unread}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
