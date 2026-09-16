import { prisma } from "@/lib/db";
import { isStaff, type SessionUser } from "@/lib/auth";
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
import { clearSupportTyping } from "@/lib/support-typing";
import { serializeSupportMessage, type LiveSupportMessage } from "@/lib/support-live";

export async function deliverSupportMessage(opts: {
  session: SessionUser;
  merchantId: string;
  body: string;
  file: File | null;
}): Promise<{ ok: true; message: LiveSupportMessage } | { ok: false; error: "store" | "empty" | "type" | "size" | "expired" }> {
  const { session } = opts;
  const merchantId = opts.merchantId;
  const body = opts.body.trim();
  const file = opts.file && opts.file.size > 0 ? opts.file : null;

  if (!merchantId) return { ok: false, error: "store" };
  if (session.role === "MERCHANT" && session.merchantId !== merchantId) return { ok: false, error: "store" };

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return { ok: false, error: "store" };
  if (!body && !file) return { ok: false, error: "empty" };
  if (file) {
    const mediaProblem = supportMediaError(file);
    if (mediaProblem) return { ok: false, error: mediaProblem };
  }

  await expireStaleSupportSessions();
  const staff = isStaff(session.role);
  let chatSession = await activeSessionForMerchant(merchantId);
  if (!chatSession && session.role === "MERCHANT") {
    const opened = await openStoreServiceSession(merchant.id, merchant.name, merchant.storeCode || merchant.id, session.name);
    chatSession = opened.session;
  }
  if (!chatSession) return { ok: false, error: "expired" };

  let attachment:
    | { attachmentKind: string; attachmentMime: string; attachmentPath: string }
    | undefined;
  if (file) {
    const saved = await saveSupportUpload(merchantId, file);
    if ("error" in saved) return { ok: false, error: saved.error ?? "type" };
    attachment = {
      attachmentKind: saved.kind,
      attachmentMime: saved.mime,
      attachmentPath: saved.relative,
    };
  }

  const thread = await threadForMerchant(merchantId);
  const created = await postSupportMessage(thread.id, staff ? "AGENT" : "STORE", body, session.userId, {
    sessionId: chatSession.id,
    ...attachment,
  });
  clearSupportTyping(merchantId, staff ? "AGENT" : "STORE");

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

  return {
    ok: true,
    message: serializeSupportMessage({ ...created, userId: session.userId, userName: session.name }),
  };
}
