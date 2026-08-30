import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { sendSupportMessage } from "@/lib/actions/support";
import { Button, Card, Empty, PageHeader } from "@/components/ui";

export default async function ServicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { error } = await searchParams;
  const staff = isStaff(session.role);

  if (staff) {
    const threads = await prisma.supportThread.findMany({
      include: {
        merchant: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { user: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const stores = await prisma.merchant.findMany({
      where: { status: { in: ["ACTIVE", "PENDING"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return (
      <div>
        <PageHeader
          title="Service inbox"
          subtitle="Reply to store conversations. Each thread is tied to a merchant so agents know who they are talking to."
        />
        {error === "store" ? (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Choose a store first.</p>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <Card>
            {threads.length === 0 ? (
              <Empty title="No conversations yet" body="Open a store from the list to start a service thread." />
            ) : (
              <ul className="divide-y divide-line">
                {threads.map((thread) => {
                  const last = thread.messages[0];
                  return (
                    <li key={thread.id}>
                      <Link href={`/service/${thread.merchantId}`} className="block px-5 py-4 hover:bg-soft">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-ink">{thread.merchant.name}</p>
                          <p className="text-xs text-muted">{format(thread.updatedAt, "MMM d, HH:mm")}</p>
                        </div>
                        <p className="mt-1 font-mono text-xs text-muted">Store ID {thread.merchant.id}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-muted">
                          {last ? `${last.user.name}: ${last.body}` : "No messages yet."}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="h-fit p-5">
            <h2 className="font-medium">Open a store thread</h2>
            <p className="mt-1 text-sm text-muted">The store identity is attached automatically.</p>
            <ul className="mt-4 space-y-2">
              {stores.map((store) => (
                <li key={store.id}>
                  <Link href={`/service/${store.id}`} className="block rounded-xl bg-soft px-3 py-2 text-sm hover:bg-accent-soft">
                    {store.name}
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
  const thread = await prisma.supportThread.upsert({
    where: { merchantId: session.merchantId },
    update: {},
    create: { merchantId: session.merchantId },
  });
  const messages = await prisma.supportMessage.findMany({
    where: { threadId: thread.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Service"
        subtitle="You are connected to Harbor support. Your store is identified from this login — do not enter a store name or ID."
      />
      {error === "empty" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Write a message first.</p>
      ) : null}
      <Card className="mb-4 space-y-1 p-5 text-sm">
        <p>
          <span className="text-muted">Store ID</span>{" "}
          <span className="font-mono text-ink">{store?.id}</span>
        </p>
        <p>
          <span className="text-muted">Store name</span> <span className="font-medium text-ink">{store?.name}</span>
        </p>
        <p>
          <span className="text-muted">Logged in as</span>{" "}
          <span className="font-medium text-ink">
            {session.name} · {session.email}
          </span>
        </p>
      </Card>
      <Card className="p-5">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted">No messages yet. Ask operations anything about this store.</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.userId === session.userId ? "bg-accent-soft text-ink" : "bg-soft"
                }`}
              >
                <p className="text-xs text-muted">
                  {message.user.name} · {format(message.createdAt, "MMM d, HH:mm")}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
              </div>
            ))
          )}
        </div>
        <form action={sendSupportMessage} className="mt-4 space-y-3">
          <textarea
            name="body"
            required
            rows={3}
            placeholder="Write a message"
            className="w-full rounded-xl border border-line p-3 text-sm outline-none ring-accent/30 focus:ring-2"
          />
          <Button type="submit">Send message</Button>
        </form>
      </Card>
    </div>
  );
}
