import type { SupportSender } from "@prisma/client";
import { prisma } from "@/lib/db";
import { welcomeBody } from "@/lib/service-bot";
import { SERVICE_SESSION_MS } from "@/lib/service-time";

export { SERVICE_SESSION_MS, formatRemaining } from "@/lib/service-time";

export async function expireStaleSupportSessions(now = new Date()) {
  try {
    await prisma.supportSession.updateMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
  } catch (error) {
    console.warn("[harbor] support session expire skipped", error);
  }
}

export async function threadForMerchant(merchantId: string) {
  return prisma.supportThread.upsert({
    where: { merchantId },
    update: {},
    create: { merchantId },
  });
}

export async function postSupportMessage(
  threadId: string,
  sender: SupportSender,
  body: string,
  userId?: string | null,
  extra?: {
    sessionId?: string | null;
    attachmentKind?: string;
    attachmentMime?: string;
    attachmentPath?: string;
  },
) {
  return prisma.supportMessage.create({
    data: {
      threadId,
      sender,
      body,
      userId: userId ?? null,
      sessionId: extra?.sessionId ?? null,
      attachmentKind: extra?.attachmentKind ?? "",
      attachmentMime: extra?.attachmentMime ?? "",
      attachmentPath: extra?.attachmentPath ?? "",
    },
  });
}

export async function activeSessionForMerchant(merchantId: string, now = new Date()) {
  await expireStaleSupportSessions(now);
  return prisma.supportSession.findFirst({
    where: { merchantId, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { startedAt: "desc" },
  });
}

export async function openStoreServiceSession(
  merchantId: string,
  storeName: string,
  storeId: string,
  userName: string,
) {
  const now = new Date();
  const existing = await activeSessionForMerchant(merchantId, now);
  if (existing) return { thread: await threadForMerchant(merchantId), session: existing, created: false };

  const thread = await threadForMerchant(merchantId);
  const session = await prisma.supportSession.create({
    data: {
      threadId: thread.id,
      merchantId,
      startedAt: now,
      expiresAt: new Date(now.getTime() + SERVICE_SESSION_MS),
      status: "ACTIVE",
    },
  });
  await postSupportMessage(thread.id, "BOT", welcomeBody(storeName, storeId, userName), null, {
    sessionId: session.id,
  });
  await prisma.supportSession.update({
    where: { id: session.id },
    data: { welcomeSentAt: now },
  });
  await prisma.supportThread.update({
    where: { id: thread.id },
    data: { intakeStep: "topic", status: "INTAKE", updatedAt: now },
  });
  return { thread, session: { ...session, welcomeSentAt: now }, created: true };
}

export async function notifyServiceCounterpart(
  merchantId: string,
  senderId: string | null,
  staffSender: boolean,
  preview: string,
) {
  const recipients = staffSender
    ? await prisma.user.findMany({ where: { merchantId, role: "MERCHANT" }, select: { id: true, role: true } })
    : await prisma.user.findMany({
        where: { role: { in: ["SUPER_ADMIN", "OPS"] } },
        select: { id: true, role: true },
      });
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients
      .filter((user) => user.id !== senderId)
      .map((user) => ({
        userId: user.id,
        title: staffSender ? "Service reply" : "Store waiting for Service",
        body: preview.slice(0, 160),
        href: staffSender ? "/service" : `/support-desk/${merchantId}`,
      })),
  });
}

export async function markStoreWaiting(threadId: string, merchantId: string, preview: string) {
  await prisma.supportThread.update({
    where: { id: threadId },
    data: { status: "WAITING_AGENT", intakeStep: "done", updatedAt: new Date() },
  });
  await notifyServiceCounterpart(merchantId, null, false, preview);
}
