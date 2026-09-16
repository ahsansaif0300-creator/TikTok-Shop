import Link from "next/link";
import { format } from "date-fns";
import { formatRemaining } from "@/lib/service-time";
import { Card, Empty, PageHeader } from "@/components/ui";
import type { SupportInboxRow } from "@/lib/support-inbox";

function lastPreview(body: string, kind: string) {
  if (kind === "IMAGE") return body ? `${body} · image` : "Image";
  if (kind === "VIDEO") return body ? `${body} · video` : "Video";
  return body || "No messages yet.";
}

function StoreRow({
  item,
  href,
  now,
  expired,
}: {
  item: SupportInboxRow;
  href: string;
  now: Date;
  expired: boolean;
}) {
  const store = item.thread.merchant;
  const last = item.messages[0];
  const waiting = item.thread.status === "WAITING_AGENT";
  return (
    <li>
      <Link href={href} className="block px-5 py-4 hover:bg-soft">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-ink">{store.name}</p>
          <p className={`text-xs font-medium ${expired ? "text-muted" : waiting ? "text-amber-800" : "text-emerald-800"}`}>
            {expired ? "Expired" : waiting ? "Waiting" : "Active"}
          </p>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">Store ID {store.storeCode || store.id}</p>
        <p className="mt-0.5 text-xs text-muted">
          {store.slug}
          {store.city ? ` · ${store.city}` : ""}
          {store.email ? ` · ${store.email}` : ""}
          {store.phone ? ` · ${store.phone}` : ""}
        </p>
        {expired ? (
          <p className="mt-1 text-xs text-muted">
            {format(item.startedAt, "MMM d, HH:mm")} → {format(item.expiresAt, "HH:mm")} · Chat saved
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">
            Started {format(item.startedAt, "MMM d, HH:mm")} · Remaining{" "}
            {formatRemaining(item.expiresAt.getTime() - now.getTime())}
          </p>
        )}
        <p className="mt-2 line-clamp-2 text-sm text-muted">
          {last ? lastPreview(last.body, last.attachmentKind) : expired ? "No messages." : "Welcome sent."}
        </p>
      </Link>
    </li>
  );
}

export function SupportBackendInbox({
  title,
  subtitle,
  threadBase,
  active,
  history,
  stores,
  now,
  error,
}: {
  title: string;
  subtitle: string;
  threadBase: string;
  active: SupportInboxRow[];
  history: SupportInboxRow[];
  stores: { id: string; name: string; storeCode: string | null; slug: string }[];
  now: Date;
  error?: string;
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      {error === "store" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Choose a store first.</p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Card>
            <div className="border-b border-line px-5 py-3">
              <h2 className="font-medium text-ink">Active Service Sessions</h2>
            </div>
            {active.length === 0 ? (
              <Empty title="No active sessions" body="A store appears here when it sends a Service message." />
            ) : (
              <ul className="divide-y divide-line">
                {active.map((item) => (
                  <StoreRow
                    key={item.id}
                    item={item}
                    href={`${threadBase}/${item.merchantId}`}
                    now={now}
                    expired={false}
                  />
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <div className="border-b border-line px-5 py-3">
              <h2 className="font-medium text-ink">Chat history</h2>
            </div>
            {history.length === 0 ? (
              <Empty title="No saved sessions" body="When a chat hour ends it leaves Active and stays here. Messages are never deleted." />
            ) : (
              <ul className="divide-y divide-line">
                {history.map((item) => (
                  <StoreRow
                    key={item.id}
                    item={item}
                    href={`${threadBase}/${item.merchantId}`}
                    now={now}
                    expired
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="h-fit p-5">
          <h2 className="font-medium">Open a store thread</h2>
          <p className="mt-1 text-sm text-muted">View saved history or continue an active hour.</p>
          <ul className="mt-4 space-y-2">
            {stores.map((store) => (
              <li key={store.id}>
                <Link href={`${threadBase}/${store.id}`} className="block rounded-xl bg-soft px-3 py-2 text-sm hover:bg-accent-soft">
                  {store.name}
                  {store.storeCode ? <span className="block font-mono text-[11px] text-muted">{store.storeCode}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
