import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { expireStaleSupportSessions } from "@/lib/service-session";
import { ServiceComposer } from "@/components/service-composer";
import { ServiceMessageBubble } from "@/components/service-message-bubble";
import { ServiceTimer } from "@/components/service-timer";
import { SupportStoreDetails } from "@/components/support-store-details";
import { Card, PageHeader } from "@/components/ui";

export default async function AdminSupportThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSuperAdmin();
  const { merchantId } = await params;
  const { error } = await searchParams;
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
        subtitle="Support Service backend. Timer is only here. When it hits zero this chat leaves Active; every message stays saved."
        actions={
          <Link href="/admin/support" className="text-sm text-accent hover:underline">
            All conversations
          </Link>
        }
      />
      {error === "empty" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Write a message or attach a file.</p>
      ) : null}
      {error === "expired" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          This store is not in an active hour. History below is still saved.
        </p>
      ) : null}
      <SupportStoreDetails
        store={store}
        threadStatus={thread.status}
        agentName={`${session.name} · ${session.email}`}
        session={chatSession}
        now={now}
      />
      {chatSession ? (
        <div className="mb-4">
          <ServiceTimer expiresAt={chatSession.expiresAt.toISOString()} reloadOnExpire />
        </div>
      ) : null}
      <Card className="p-5">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted">No messages yet. They appear here as soon as the store writes in Service.</p>
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
