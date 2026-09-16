"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";
import { supportInboxPath, supportThreadPath } from "@/lib/support-paths";
import { deliverSupportMessage } from "@/lib/support-deliver";
import { openStoreServiceSession, postSupportMessage, markStoreWaiting } from "@/lib/service-session";

function fail(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

export async function sendSupportMessage(formData: FormData) {
  const session = await requireSession();
  const body = String(formData.get("body") ?? "").trim();
  const file = formData.get("media");
  const merchantIdRaw = session.role === "MERCHANT" ? session.merchantId : String(formData.get("merchantId") ?? "");
  const next = supportThreadPath(session.role, merchantIdRaw || "");
  if (!merchantIdRaw) fail(supportInboxPath(session.role), "store");
  const merchantId = merchantIdRaw;

  const result = await deliverSupportMessage({
    session,
    merchantId,
    body,
    file: file instanceof File ? file : null,
  });
  if (!result.ok) fail(next, result.error);

  revalidatePath("/", "layout");
  revalidatePath("/service");
  revalidatePath("/support-desk");
  revalidatePath("/admin/support");
  revalidatePath(`/service/${merchantId}`);
  revalidatePath(`/support-desk/${merchantId}`);
  revalidatePath(`/admin/support/${merchantId}`);
  redirect(next);
}

export async function startServiceSession() {
  const session = await requireSession();
  if (session.role !== "MERCHANT" || !session.merchantId) redirect("/");
  const merchant = await prisma.merchant.findUnique({ where: { id: session.merchantId } });
  if (!merchant) redirect("/");
  await openStoreServiceSession(merchant.id, merchant.name, merchant.storeCode || merchant.id, session.name);
  revalidatePath("/service");
  revalidatePath("/support-desk");
  revalidatePath("/admin/support");
  revalidatePath(`/support-desk/${merchant.id}`);
  revalidatePath(`/admin/support/${merchant.id}`);
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
  revalidatePath("/service");
  revalidatePath("/support-desk");
  revalidatePath("/admin/support");
  revalidatePath(`/support-desk/${merchant.id}`);
  revalidatePath(`/admin/support/${merchant.id}`);
  redirect("/recharge?sent=1");
}
