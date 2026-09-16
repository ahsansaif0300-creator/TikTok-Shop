import { prisma } from "@/lib/db";
import { expireStaleSupportSessions } from "@/lib/service-session";
import { loadSupportInbox } from "@/lib/support-inbox";
import { toDeskItem } from "@/lib/support-desk";
import { readSupportTyping } from "@/lib/support-typing";

export type LiveSupportMessage = {
  id: string;
  sender: string;
  userId: string | null;
  userName: string | null;
  body: string;
  createdAt: string;
  attachmentKind: string;
};

export function serializeSupportMessage(message: {
  id: string;
  sender: string;
  body: string;
  createdAt: Date;
  attachmentKind?: string | null;
  userId?: string | null;
  user?: { name: string } | null;
  userName?: string | null;
}): LiveSupportMessage {
  return {
    id: message.id,
    sender: message.sender,
    userId: message.userId ?? null,
    userName: message.user?.name ?? message.userName ?? null,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    attachmentKind: message.attachmentKind ?? "",
  };
}

export async function loadLiveThread(merchantId: string) {
  const now = new Date();
  await expireStaleSupportSessions(now);
  const thread = await prisma.supportThread.findUnique({ where: { merchantId } });
  if (!thread) {
    return {
      messages: [],
      expired: true,
      expiresAt: null,
      threadStatus: "INTAKE",
      typing: readSupportTyping(merchantId),
    };
  }
  const chatSession = await prisma.supportSession.findFirst({
    where: { merchantId, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { startedAt: "desc" },
  });
  const rows = await prisma.supportMessage.findMany({
    where: { threadId: thread.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    messages: rows.map(serializeSupportMessage),
    expired: !chatSession,
    expiresAt: chatSession?.expiresAt.toISOString() ?? null,
    threadStatus: thread.status,
    typing: readSupportTyping(merchantId),
  };
}

export async function loadLiveInbox() {
  const inbox = await loadSupportInbox();
  return {
    active: inbox.active.map((item) => ({
      ...toDeskItem(item),
      typing: readSupportTyping(item.merchantId).store,
    })),
    history: inbox.history.map(toDeskItem),
    stores: inbox.stores,
  };
}

