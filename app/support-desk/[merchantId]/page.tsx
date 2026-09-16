import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSupportDesk } from "@/lib/auth";
import { expireStaleSupportSessions } from "@/lib/service-session";
import { ServiceComposer } from "@/components/service-composer";
import { ServiceMessageBubble } from "@/components/service-message-bubble";
import { ServiceTimer } from "@/components/service-timer";
import { SupportStoreDetails } from "@/components/support-store-details";

export default async function SupportDeskThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSupportDesk();
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
    <section className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col bg-soft">
      <div className="border-b border-line bg-card px-4 py-3 lg:px-6">
        <Link href="/support-desk" className="mb-2 inline-block text-sm text-accent hover:underline lg:hidden">
          All conversations
        </Link>
        <h1 className="text-lg font-semibold text-ink">{store.name}</h1>
        <p className="text-sm text-muted">Timer is on this chat. When it hits zero the store leaves Active; messages stay saved.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
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
        <div className="space-y-3 rounded-2xl border border-line bg-card p-5">
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
          <ServiceComposer merchantId={store.id} expiresAt={chatSession?.expiresAt.toISOString()} locked={expired} />
        </div>
      </div>
    </section>
  );
}
