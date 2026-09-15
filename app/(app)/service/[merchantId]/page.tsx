import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { expireStaleSupportSessions, formatRemaining } from "@/lib/service-session";
import { ServiceComposer } from "@/components/service-composer";
import { ServiceMessageBubble } from "@/components/service-message-bubble";
import { ServiceTimer } from "@/components/service-timer";
import { Card, PageHeader } from "@/components/ui";

const STATUS_LABEL = {
  INTAKE: "Assistant intake",
  WAITING_AGENT: "Waiting for support",
  WITH_AGENT: "With support team",
};

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

  const now = new Date();
  await expireStaleSupportSessions(now);

  const thread = await prisma.supportThread.upsert({
    where: { merchantId },
    update: {},
    create: { merchantId },
  });
  const chatSession = await prisma.supportSession.findFirst({
    where: { merchantId, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { startedAt: "desc" },
  });
  const messages = await prisma.supportMessage.findMany({
    where: { threadId: thread.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const expired = !chatSession;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={store.name}
        subtitle="Store identity is already on this thread. Reply during an active hour; history stays after expiry."
        actions={
          <Link href="/service" className="text-sm text-accent hover:underline">
            All conversations
          </Link>
        }
      />
      {error === "empty" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Write a message or attach a file.</p>
      ) : null}
      {error === "expired" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          This store is not in an active 1-hour session. History below is still saved.
        </p>
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
          <span className="text-muted">Store contact</span> {store.email} · {store.phone}
        </p>
        <p>
          <span className="text-muted">Status</span> {expired ? "Expired" : (STATUS_LABEL[thread.status] ?? thread.status)}
        </p>
        {chatSession ? (
          <>
            <p>
              <span className="text-muted">Session start</span> {format(chatSession.startedAt, "MMM d, HH:mm")}
            </p>
            <p>
              <span className="text-muted">Session expiry</span> {format(chatSession.expiresAt, "MMM d, HH:mm")} · Remaining{" "}
              {formatRemaining(chatSession.expiresAt.getTime() - now.getTime())}
            </p>
          </>
        ) : (
          <p className="text-muted">No active service session. Previous messages remain below.</p>
        )}
        <p>
          <span className="text-muted">You</span> {session.name} · {session.email}
        </p>
      </Card>
      {chatSession ? (
        <div className="mb-4">
          <ServiceTimer expiresAt={chatSession.expiresAt.toISOString()} />
        </div>
      ) : null}
      <Card className="p-5">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted">No messages yet.</p>
          ) : (
            messages.map((message) => (
              <ServiceMessageBubble
                key={message.id}
                id={message.id}
                sender={message.sender}
                userName={message.user?.name}
                body={message.body}
                createdAt={message.createdAt}
                attachmentKind={message.attachmentKind}
                highlight={message.sender === "AGENT" && message.userId === session.userId}
              />
            ))
          )}
        </div>
        <ServiceComposer merchantId={store.id} expiresAt={chatSession?.expiresAt.toISOString()} locked={expired} />
      </Card>
    </div>
  );
}
