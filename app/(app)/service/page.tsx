import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { expireStaleSupportSessions, formatRemaining, openStoreServiceSession } from "@/lib/service-session";
import { ServiceComposer } from "@/components/service-composer";
import { ServiceMessageBubble } from "@/components/service-message-bubble";
import { ServiceTimer } from "@/components/service-timer";
import { Card, Empty, PageHeader } from "@/components/ui";
import { BRAND_NAME } from "@/lib/brand-name";

const STATUS_LABEL = {
  INTAKE: "Assistant intake",
  WAITING_AGENT: "Waiting for support",
  WITH_AGENT: "With support team",
};

function lastPreview(body: string, kind: string) {
  if (kind === "IMAGE") return body ? `${body} · image` : "Image";
  if (kind === "VIDEO") return body ? `${body} · video` : "Video";
  return body || "No messages yet.";
}

export default async function ServicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { error } = await searchParams;
  const staff = isStaff(session.role);
  const now = new Date();
  await expireStaleSupportSessions(now);

  if (staff) {
    const [active, history] = await Promise.all([
      prisma.supportSession.findMany({
        where: { status: "ACTIVE", expiresAt: { gt: now } },
        include: {
          thread: { include: { merchant: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, include: { user: true } },
        },
        orderBy: { startedAt: "desc" },
      }),
      prisma.supportSession.findMany({
        where: { OR: [{ status: "EXPIRED" }, { expiresAt: { lte: now } }] },
        include: {
          thread: { include: { merchant: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { expiresAt: "desc" },
        take: 40,
      }),
    ]);

    return (
      <div>
        <PageHeader
          title="Service inbox"
          subtitle="Active 1-hour store sessions. Expired chats stay in history and are never deleted."
        />
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
                <Empty title="No active sessions" body="A store appears here when it opens Service." />
              ) : (
                <ul className="divide-y divide-line">
                  {active.map((item) => {
                    const last = item.messages[0];
                    return (
                      <li key={item.id}>
                        <Link href={`/service/${item.merchantId}`} className="block px-5 py-4 hover:bg-soft">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-ink">{item.thread.merchant.name}</p>
                            <p className="text-xs font-medium text-emerald-800">Active</p>
                          </div>
                          <p className="mt-1 font-mono text-xs text-muted">
                            Store ID {item.thread.merchant.storeCode || item.thread.merchant.id}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            Started {format(item.startedAt, "MMM d, HH:mm")} · Expires{" "}
                            {format(item.expiresAt, "HH:mm")} · Remaining {formatRemaining(item.expiresAt.getTime() - now.getTime())}
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm text-muted">
                            {last ? lastPreview(last.body, last.attachmentKind) : "Welcome sent."}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card>
              <div className="border-b border-line px-5 py-3">
                <h2 className="font-medium text-ink">Chat history</h2>
              </div>
              {history.length === 0 ? (
                <Empty title="No expired sessions" body="Past 1-hour sessions will list here. Messages stay saved." />
              ) : (
                <ul className="divide-y divide-line">
                  {history.map((item) => {
                    const last = item.messages[0];
                    return (
                      <li key={item.id}>
                        <Link href={`/service/${item.merchantId}`} className="block px-5 py-4 hover:bg-soft">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-ink">{item.thread.merchant.name}</p>
                            <p className="text-xs text-muted">Expired</p>
                          </div>
                          <p className="mt-1 font-mono text-xs text-muted">
                            Store ID {item.thread.merchant.storeCode || item.thread.merchant.id}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {format(item.startedAt, "MMM d, HH:mm")} → {format(item.expiresAt, "HH:mm")}
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm text-muted">
                            {last ? lastPreview(last.body, last.attachmentKind) : "No messages."}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
          <Card className="h-fit p-5">
            <h2 className="font-medium">Open a store thread</h2>
            <p className="mt-1 text-sm text-muted">View history or continue an active hour.</p>
            <ul className="mt-4 space-y-2">
              {(
                await prisma.merchant.findMany({
                  where: { status: { in: ["ACTIVE", "PENDING"] } },
                  orderBy: { name: "asc" },
                  select: { id: true, name: true, storeCode: true },
                })
              ).map((store) => (
                <li key={store.id}>
                  <Link href={`/service/${store.id}`} className="block rounded-xl bg-soft px-3 py-2 text-sm hover:bg-accent-soft">
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

  if (!session.merchantId) {
    return (
      <div>
        <PageHeader title="Service" subtitle="This login is not linked to a store." />
      </div>
    );
  }

  const store = await prisma.merchant.findUnique({ where: { id: session.merchantId } });
  if (!store) {
    return (
      <div>
        <PageHeader title="Service" subtitle="Store record is missing." />
      </div>
    );
  }

  const opened = await openStoreServiceSession(store.id, store.name, store.storeCode || store.id, session.name);
  const thread = opened.thread;
  const chatSession = opened.session;
  const expired = chatSession.status !== "ACTIVE" || chatSession.expiresAt.getTime() <= now.getTime();
  const messages = await prisma.supportMessage.findMany({
    where: { threadId: thread.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Service"
        subtitle={`${BRAND_NAME} support assistant. Your store is identified from this login — you do not enter a Store ID.`}
      />
      {error === "empty" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Write a message or attach an image/video.</p>
      ) : null}
      {error === "type" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Use a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file.</p>
      ) : null}
      {error === "size" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Images must be under 5 MB and videos under 20 MB.</p>
      ) : null}
      {error === "expired" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">That service hour ended. Start a new session to continue.</p>
      ) : null}
      <Card className="mb-4 space-y-1 p-5 text-sm">
        <p>
          <span className="text-muted">Store ID</span>{" "}
          <span className="font-mono text-ink">{store.storeCode || store.id}</span>
        </p>
        <p>
          <span className="text-muted">Store name</span> <span className="font-medium text-ink">{store.name}</span>
        </p>
        <p>
          <span className="text-muted">Logged in as</span>{" "}
          <span className="font-medium text-ink">
            {session.name} · {session.email}
          </span>
        </p>
        <p>
          <span className="text-muted">Status</span> {expired ? "Expired" : (STATUS_LABEL[thread.status] ?? thread.status)}
        </p>
        <p>
          <span className="text-muted">Session</span> {format(chatSession.startedAt, "HH:mm")} – {format(chatSession.expiresAt, "HH:mm")}
        </p>
      </Card>
      <div className="mb-4">
        <ServiceTimer expiresAt={chatSession.expiresAt.toISOString()} />
      </div>
      <Card className="p-5">
        <div className="space-y-3">
          {messages.map((message) => (
            <ServiceMessageBubble
              key={message.id}
              id={message.id}
              sender={message.sender}
              userName={message.user?.name}
              body={message.body}
              createdAt={message.createdAt}
              attachmentKind={message.attachmentKind}
              highlight={message.sender === "STORE"}
            />
          ))}
        </div>
        <ServiceComposer expiresAt={chatSession.expiresAt.toISOString()} showTopics allowRestart />
      </Card>
    </div>
  );
}
