"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";

async function threadForMerchant(merchantId: string) {
  return prisma.supportThread.upsert({
    where: { merchantId },
    update: {},
    create: { merchantId },
  });
}

async function notifyCounterpart(merchantId: string, senderId: string, staffSender: boolean, preview: string) {
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
        title: staffSender ? "Service reply" : "New store service message",
        body: preview.slice(0, 160),
        href: staffSender ? "/service" : `/service/${merchantId}`,
      })),
  });
}

export async function sendSupportMessage(formData: FormData) {
  const session = await requireSession();
  const body = String(formData.get("body") ?? "").trim();
  const merchantId = session.role === "MERCHANT" ? session.merchantId : String(formData.get("merchantId") ?? "");
  const next = session.role === "MERCHANT" ? "/service" : `/service/${merchantId}`;
  if (!body) redirect(`${next}?error=empty`);
  if (!merchantId) redirect("/service?error=store");

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) redirect("/service?error=store");
  if (session.role === "MERCHANT" && session.merchantId !== merchantId) {
    redirect("/service?error=store");
  }

  const thread = await threadForMerchant(merchantId);
  await prisma.supportMessage.create({
    data: { threadId: thread.id, userId: session.userId, body },
  });
  await prisma.supportThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });
  await notifyCounterpart(merchantId, session.userId, isStaff(session.role), body);
  revalidatePath("/", "layout");
  redirect(next);
}

export async function requestRecharge(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "MERCHANT" || !session.merchantId) redirect("/");
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) redirect("/recharge?error=invalid");

  const thread = await threadForMerchant(session.merchantId);
  const body = [`Recharge request: ${money(amount)}.`, "This does not add funds automatically.", note && `Note: ${note}`]
    .filter(Boolean)
    .join(" ");
  await prisma.supportMessage.create({
    data: { threadId: thread.id, userId: session.userId, body },
  });
  await prisma.supportThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });
  await notifyCounterpart(session.merchantId, session.userId, false, body);
  revalidatePath("/", "layout");
  redirect("/recharge?sent=1");
}
