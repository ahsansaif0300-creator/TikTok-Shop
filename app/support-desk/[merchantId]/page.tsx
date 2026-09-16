import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSupportDesk } from "@/lib/auth";
import { expireStaleSupportSessions } from "@/lib/service-session";
import { ServiceTimer } from "@/components/service-timer";
import { SupportStoreDetails } from "@/components/support-store-details";
import { SupportLiveChat } from "@/components/support-live-chat";
import { serializeSupportMessage } from "@/lib/support-live";

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
        <div className="rounded-2xl border border-line bg-card p-5">
          <SupportLiveChat
            key={store.id}
            merchantId={store.id}
            initialMessages={messages.map(serializeSupportMessage)}
            expiresAt={chatSession?.expiresAt.toISOString()}
            locked={expired}
            selfUserId={session.userId}
          />
        </div>
      </div>
    </section>
  );
}
