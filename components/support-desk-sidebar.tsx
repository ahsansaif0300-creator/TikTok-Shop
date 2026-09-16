"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatRemaining } from "@/lib/service-time";

export type SupportDeskListItem = {
  id: string;
  merchantId: string;
  startedAt: string;
  expiresAt: string;
  waiting: boolean;
  lastPreview: string;
  typing?: string | null;
  store: {
    name: string;
    storeCode: string | null;
    id: string;
    city: string;
    email: string;
    phone: string;
  };
};

function lastLine(item: SupportDeskListItem, expired: boolean) {
  if (expired) {
    const start = new Date(item.startedAt);
    return `${start.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · Chat saved`;
  }
  const remaining = new Date(item.expiresAt).getTime() - Date.now();
  return `Remaining ${formatRemaining(remaining)}`;
}

function Row({
  item,
  href,
  selected,
  expired,
}: {
  item: SupportDeskListItem;
  href: string;
  selected: boolean;
  expired: boolean;
}) {
  const tone = expired ? "text-muted" : item.waiting ? "text-amber-800" : "text-emerald-800";
  return (
    <li>
      <Link
        href={href}
        className={`block border-b border-line px-4 py-3 hover:bg-soft ${selected ? "bg-accent-soft" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium text-ink">{item.store.name}</p>
          <p className={`shrink-0 text-[11px] font-medium ${tone}`}>{expired ? "Expired" : item.waiting ? "Waiting" : "Active"}</p>
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-muted">Store ID {item.store.storeCode || item.store.id}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {[item.store.city, item.store.email, item.store.phone].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-[11px] text-muted">{lastLine(item, expired)}</p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">
          {item.typing ? `${item.typing} is typing…` : item.lastPreview}
        </p>
      </Link>
    </li>
  );
}

export function SupportDeskSidebar({
  active: initialActive,
  history: initialHistory,
  stores: initialStores,
}: {
  active: SupportDeskListItem[];
  history: SupportDeskListItem[];
  stores: { id: string; name: string; storeCode: string | null }[];
}) {
  const pathname = usePathname();
  const selected = pathname.startsWith("/support-desk/") ? pathname.split("/")[2] : "";
  const [active, setActive] = useState(initialActive);
  const [history, setHistory] = useState(initialHistory);
  const [stores, setStores] = useState(initialStores);

  useEffect(() => {
    let stop = false;
    async function pull() {
      try {
        const res = await fetch("/api/support/live?inbox=1", { cache: "no-store" });
        if (!res.ok || stop) return;
        const ctype = res.headers.get("content-type") || "";
        if (!ctype.includes("application/json")) return;
        const json = (await res.json()) as {
          inbox?: {
            active: SupportDeskListItem[];
            history: SupportDeskListItem[];
            stores: { id: string; name: string; storeCode: string | null }[];
          };
        };
        if (stop || !json.inbox) return;
        setActive(json.inbox.active);
        setHistory(json.inbox.history);
        setStores(json.inbox.stores);
      } catch {
        return;
      }
    }
    void pull();
    const id = setInterval(() => {
      if (document.hidden) return;
      void pull();
    }, 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);
  return (
    <aside className={`border-r border-line bg-card ${selected ? "hidden lg:block" : "block"}`}>
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-medium text-ink">Active Service Sessions</h2>
        <p className="text-xs text-muted">Open a row to reply. Timer stays on the chat.</p>
      </div>
      {active.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">No active sessions. A store appears here when it writes in Service.</p>
      ) : (
        <ul>
          {active.map((item) => (
            <Row
              key={item.id}
              item={item}
              href={`/support-desk/${item.merchantId}`}
              selected={selected === item.merchantId}
              expired={false}
            />
          ))}
        </ul>
      )}
      <div className="border-b border-t border-line px-4 py-3">
        <h2 className="font-medium text-ink">Chat history</h2>
        <p className="text-xs text-muted">When time ends the chat leaves Active and stays saved.</p>
      </div>
      {history.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">No saved sessions yet.</p>
      ) : (
        <ul>
          {history.map((item) => (
            <Row
              key={item.id}
              item={item}
              href={`/support-desk/${item.merchantId}`}
              selected={selected === item.merchantId}
              expired
            />
          ))}
        </ul>
      )}
      <div className="px-4 py-4">
        <h2 className="font-medium text-ink">Open a store</h2>
        <ul className="mt-2 space-y-1">
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                href={`/support-desk/${store.id}`}
                className={`block rounded-xl px-3 py-2 text-sm hover:bg-accent-soft ${selected === store.id ? "bg-accent-soft" : "bg-soft"}`}
              >
                {store.name}
                {store.storeCode ? <span className="block font-mono text-[11px] text-muted">{store.storeCode}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
