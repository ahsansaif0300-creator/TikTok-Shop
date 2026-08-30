import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { ServiceComposer } from "@/components/service-composer";
import { Card, PageHeader } from "@/components/ui";

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

export default async function ServiceThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { merchantId } = await params;
  const { error } = await searchParams;
  if (!isStaff(session.role)) redirect("/service");

  const store = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!store) notFound();

  const thread = await prisma.supportThread.upsert({
    where: { merchantId },
    update: {},
    create: { merchantId },
  });
  const messages = await prisma.supportMessage.findMany({
    where: { threadId: thread.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={store.name}
        subtitle="Take over this Service chat. Store identity is already on the thread."
        actions={
          <Link href="/service" className="text-sm text-accent hover:underline">
            All conversations
          </Link>
        }
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
          <span className="text-muted">Store contact</span> {store.email} · {store.phone}
        </p>
        <p>
          <span className="text-muted">Status</span> {STATUS_LABEL[thread.status] ?? thread.status}
          {thread.intakeTopic ? ` · ${thread.intakeTopic}` : ""}
        </p>
        {thread.intakeDetail ? (
          <p>
            <span className="text-muted">Assistant notes</span> {thread.intakeDetail}
          </p>
        ) : null}
        <p>
          <span className="text-muted">You</span> {session.name} · {session.email}
        </p>
      </Card>
      <Card className="p-5">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted">No messages yet. You can start the conversation with this store.</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.sender === "AGENT" && message.userId === session.userId ? "bg-accent-soft text-ink" : "bg-soft"
                }`}
              >
                <p className="text-xs text-muted">
                  {senderLabel(message.sender, message.user?.name)} · {format(message.createdAt, "MMM d, HH:mm")}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
              </div>
            ))
          )}
        </div>
        <ServiceComposer merchantId={store.id} status={thread.status} />
      </Card>
    </div>
  );
}
