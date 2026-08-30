import type { SupportSender, SupportThreadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { detailsPrompt, handoffBody, matchTopic, welcomeBody } from "@/lib/service-bot";

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
) {
  return prisma.supportMessage.create({
    data: { threadId, sender, body, userId: userId ?? null },
  });
}

export async function ensureServiceWelcome(merchantId: string, storeName: string, storeId: string, userName: string) {
  const thread = await threadForMerchant(merchantId);
  const count = await prisma.supportMessage.count({ where: { threadId: thread.id } });
  if (count === 0) {
    await postSupportMessage(thread.id, "BOT", welcomeBody(storeName, storeId, userName));
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: { intakeStep: "topic", status: "INTAKE", updatedAt: new Date() },
    });
  }
  return prisma.supportThread.findUniqueOrThrow({ where: { id: thread.id } });
}

export async function notifyServiceCounterpart(
  merchantId: string,
  senderId: string | null,
  staffSender: boolean,
  preview: string,
) {
  const recipients = staffSender
    ? await prisma.user.findMany({ where: { merchantId, role: "MERCHANT" }, select: { id: true } })
    : await prisma.user.findMany({
        where: { role: { in: ["SUPER_ADMIN", "OPS"] } },
        select: { id: true },
      });
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients
      .filter((user) => user.id !== senderId)
      .map((user) => ({
        userId: user.id,
        title: staffSender ? "Service reply" : "Store waiting for Service",
        body: preview.slice(0, 160),
        href: staffSender ? "/service" : `/service/${merchantId}`,
      })),
  });
}

export async function botAfterStoreMessage(
  thread: { id: string; intakeStep: string; intakeTopic: string; status: SupportThreadStatus },
  merchant: { id: string; name: string },
  userName: string,
  body: string,
) {
  if (thread.status === "WITH_AGENT" || thread.status === "WAITING_AGENT") return;

  if (thread.intakeStep === "welcome" || thread.intakeStep === "topic") {
    const topic = matchTopic(body);
    await postSupportMessage(thread.id, "BOT", detailsPrompt(topic));
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: { intakeStep: "details", intakeTopic: topic, updatedAt: new Date() },
    });
    return;
  }

  if (thread.intakeStep === "details") {
    const topic = thread.intakeTopic || matchTopic(body);
    await postSupportMessage(thread.id, "BOT", handoffBody(merchant.name, merchant.id, userName, topic, body));
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: {
        intakeStep: "done",
        intakeTopic: topic,
        intakeDetail: body,
        status: "WAITING_AGENT",
        updatedAt: new Date(),
      },
    });
    await notifyServiceCounterpart(merchant.id, null, false, `${merchant.name} is waiting for Service: ${topic}`);
  }
}
