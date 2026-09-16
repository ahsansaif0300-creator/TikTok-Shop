import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { openStoreServiceSession } from "@/lib/service-session";
import { loadSupportInbox } from "@/lib/support-inbox";
import { ServiceComposer } from "@/components/service-composer";
import { ServiceMessageBubble } from "@/components/service-message-bubble";
import { SupportBackendInbox } from "@/components/support-backend-inbox";
import { Card, PageHeader } from "@/components/ui";
import { BRAND_NAME } from "@/lib/brand-name";

const STATUS_LABEL = {
  INTAKE: "Assistant intake",
  WAITING_AGENT: "Waiting for support",
  WITH_AGENT: "With support team",
};

export default async function ServicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { error } = await searchParams;
  if (session.role === "SUPER_ADMIN") redirect("/admin/support");
  const staff = isStaff(session.role);

  if (staff) {
    const inbox = await loadSupportInbox();
    return (
      <SupportBackendInbox
        title="Service inbox"
        subtitle="Store chats land here with name and Store ID. The 1-hour timer lives on the open chat. Expired chats leave Active and stay in history."
        threadBase="/service"
        active={inbox.active}
        history={inbox.history}
        stores={inbox.stores}
        now={inbox.now}
        error={error}
      />
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
  const now = new Date();
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
        subtitle={`${BRAND_NAME} support. Your store is identified from this login. Messages go to the Support Service backend.`}
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
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">That support chat ended. Start a new chat to continue. Old messages stay saved.</p>
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
          <span className="text-muted">Status</span> {expired ? "Chat ended" : (STATUS_LABEL[thread.status] ?? thread.status)}
        </p>
      </Card>
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
        <ServiceComposer expiresAt={chatSession.expiresAt.toISOString()} showTopics allowRestart storeMode />
      </Card>
    </div>
  );
}
