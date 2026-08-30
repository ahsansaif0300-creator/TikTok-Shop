import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { ensureServiceWelcome } from "@/lib/service-thread";
import { ServiceComposer } from "@/components/service-composer";
import { Card, Empty, PageHeader } from "@/components/ui";

const STATUS_LABEL = {
  INTAKE: "Assistant intake",
  WAITING_AGENT: "Waiting for support",
  WITH_AGENT: "With support team",
};

function senderLabel(sender: string, name?: string | null) {
  if (sender === "BOT") return "Harbor Service assistant";
  if (sender === "AGENT") return `${name ?? "Support"} · team`;
  return `${name ?? "Store"} · store`;
}

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
          subtitle="Stores start with the Service assistant, then a team member takes over. Each thread is already tied to a store."
        />
        {error === "store" ? (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Choose a store first.</p>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <Card>
            {threads.length === 0 ? (
              <Empty title="No conversations yet" body="Open a store from the list when a seller needs help." />
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
                        <p className="mt-1 text-xs font-medium text-accent">
                          {STATUS_LABEL[thread.status] ?? thread.status}
                          {thread.intakeTopic ? ` · ${thread.intakeTopic}` : ""}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-muted">
                          {last
                            ? `${senderLabel(last.sender, last.user?.name)}: ${last.body}`
                            : "No messages yet."}
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
            <p className="mt-1 text-sm text-muted">Take over after the assistant has the basics.</p>
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
  if (!store) {
    return (
      <div>
        <PageHeader title="Service" subtitle="Store record is missing." />
      </div>
    );
  }

  await ensureServiceWelcome(store.id, store.name, store.id, session.name);
  const thread = await prisma.supportThread.findUnique({ where: { merchantId: store.id } });
  const messages = thread
    ? await prisma.supportMessage.findMany({
        where: { threadId: thread.id },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Service"
        subtitle="Harbor support. The assistant asks a few basics, then a team member joins. Your store is identified from this login."
      />
      {error === "empty" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Write a message first.</p>
      ) : null}
      <Card className="mb-4 space-y-1 p-5 text-sm">
        <p>
          <span className="text-muted">Store ID</span> <span className="font-mono text-ink">{store.id}</span>
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
          <span className="text-muted">Status</span> {STATUS_LABEL[thread?.status ?? "INTAKE"]}
        </p>
      </Card>
      <Card className="p-5">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                message.sender === "STORE" ? "bg-accent-soft text-ink" : "bg-soft"
              }`}
            >
              <p className="text-xs text-muted">
                {senderLabel(message.sender, message.user?.name)} · {format(message.createdAt, "MMM d, HH:mm")}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
            </div>
          ))}
        </div>
        <ServiceComposer intakeStep={thread?.intakeStep} status={thread?.status} />
      </Card>
    </div>
  );
}
