"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";
import { saveSupportUpload, supportMediaError } from "@/lib/support-media";
import {
  activeSessionForMerchant,
  expireStaleSupportSessions,
  markStoreWaiting,
  notifyServiceCounterpart,
  openStoreServiceSession,
  postSupportMessage,
  threadForMerchant,
} from "@/lib/service-session";

function fail(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

export async function sendSupportMessage(formData: FormData) {
  const session = await requireSession();
  const body = String(formData.get("body") ?? "").trim();
  const file = formData.get("media");
  const merchantIdRaw = session.role === "MERCHANT" ? session.merchantId : String(formData.get("merchantId") ?? "");
  const next = session.role === "MERCHANT" ? "/service" : `/service/${merchantIdRaw}`;
  if (!merchantIdRaw) fail("/service", "store");
  const merchantId = merchantIdRaw;

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) fail("/service", "store");
  if (session.role === "MERCHANT" && session.merchantId !== merchantId) fail("/service", "store");

  const upload = file instanceof File && file.size > 0 ? file : null;
  if (!body && !upload) fail(next, "empty");
  if (upload) {
    const mediaProblem = supportMediaError(upload);
    if (mediaProblem) fail(next, mediaProblem);
  }

  await expireStaleSupportSessions();
  const staff = isStaff(session.role);
  let chatSession = await activeSessionForMerchant(merchantId);
  if (!chatSession && session.role === "MERCHANT") {
    const opened = await openStoreServiceSession(merchant.id, merchant.name, merchant.storeCode || merchant.id, session.name);
    chatSession = opened.session;
  }
  if (!chatSession) fail(next, "expired");

  let attachment:
    | { attachmentKind: string; attachmentMime: string; attachmentPath: string }
    | undefined;
  if (upload) {
    const saved = await saveSupportUpload(merchantId, upload);
    if ("error" in saved) {
      fail(next, saved.error ?? "type");
    } else {
      attachment = {
        attachmentKind: saved.kind,
        attachmentMime: saved.mime,
        attachmentPath: saved.relative,
      };
    }
  }

  const thread = await threadForMerchant(merchantId);
  await postSupportMessage(thread.id, staff ? "AGENT" : "STORE", body, session.userId, {
    sessionId: chatSession.id,
    ...attachment,
  });

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
    await notifyServiceCounterpart(merchantId, session.userId, true, body || "Sent a file");
  } else {
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });
    await markStoreWaiting(thread.id, merchant.id, body || `${merchant.name} sent a file`);
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function startServiceSession() {
  const session = await requireSession();
  if (session.role !== "MERCHANT" || !session.merchantId) redirect("/");
  const merchant = await prisma.merchant.findUnique({ where: { id: session.merchantId } });
  if (!merchant) redirect("/");
  await openStoreServiceSession(merchant.id, merchant.name, merchant.storeCode || merchant.id, session.name);
  revalidatePath("/service");
  redirect("/service");
}

export async function requestRecharge(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "MERCHANT" || !session.merchantId) redirect("/");
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) redirect("/recharge?error=invalid");

  const merchant = await prisma.merchant.findUnique({ where: { id: session.merchantId } });
  if (!merchant) redirect("/");
  const opened = await openStoreServiceSession(
    merchant.id,
    merchant.name,
    merchant.storeCode || merchant.id,
    session.name,
  );
  const body = [`Recharge request: ${money(amount)}.`, "This does not add funds automatically.", note && `Note: ${note}`]
    .filter(Boolean)
    .join(" ");
  await postSupportMessage(opened.thread.id, "STORE", body, session.userId, { sessionId: opened.session.id });
  await markStoreWaiting(opened.thread.id, merchant.id, body);
  revalidatePath("/", "layout");
  redirect("/recharge?sent=1");
}
