"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";
import {
  botAfterStoreMessage,
  ensureServiceWelcome,
  notifyServiceCounterpart,
  postSupportMessage,
  threadForMerchant,
} from "@/lib/service-thread";

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
  const staff = isStaff(session.role);

  await postSupportMessage(thread.id, staff ? "AGENT" : "STORE", body, session.userId);

  if (staff) {
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: {
        status: "WITH_AGENT",
        agentId: session.userId,
        agentJoinedAt: thread.agentJoinedAt ?? new Date(),
        updatedAt: new Date(),
      },
    });
    await notifyServiceCounterpart(merchantId, session.userId, true, body);
  } else {
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });
    await botAfterStoreMessage(thread, merchant, session.name, body);
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function requestRecharge(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "MERCHANT" || !session.merchantId) redirect("/");
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) redirect("/recharge?error=invalid");

  const merchant = await prisma.merchant.findUnique({ where: { id: session.merchantId } });
  if (!merchant) redirect("/");
  await ensureServiceWelcome(merchant.id, merchant.name, merchant.id, session.name);
  const thread = await threadForMerchant(session.merchantId);
  const body = [`Recharge request: ${money(amount)}.`, "This does not add funds automatically.", note && `Note: ${note}`]
    .filter(Boolean)
    .join(" ");
  await postSupportMessage(thread.id, "STORE", body, session.userId);
  await botAfterStoreMessage(
    await prisma.supportThread.findUniqueOrThrow({ where: { id: thread.id } }),
    merchant,
    session.name,
    body,
  );
  revalidatePath("/", "layout");
  redirect("/recharge?sent=1");
}
