"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, requireMerchant } from "@/lib/auth";
import { fileToDataUrl, logoError } from "@/lib/logo";

export async function updatePersonalInformation(formData: FormData) {
  const session = await requireMerchant();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!name || !email) redirect("/account?error=invalid");

  const taken = await prisma.user.findFirst({
    where: { email, NOT: { id: session.userId } },
    select: { id: true },
  });
  if (taken) redirect("/account?error=email");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.userId },
      data: { name, email },
    }),
    prisma.merchant.update({
      where: { id: session.merchantId },
      data: { phone, email },
    }),
  ]);
  await createSession({ ...session, name, email });
  redirect("/account?saved=1");
}

export async function updateStoreLogo(formData: FormData) {
  const session = await requireMerchant();
  const file = formData.get("logo");
  if (!(file instanceof File)) redirect("/account?error=logo");
  const problem = logoError(file);
  if (problem) redirect(`/account?error=logo-${problem}`);
  const logo = await fileToDataUrl(file);
  await prisma.merchant.update({
    where: { id: session.merchantId },
    data: { logo },
  });
  redirect("/account?logo=1");
}

export async function changePaymentPassword(formData: FormData) {
  const session = await requireMerchant();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next.length < 8) redirect("/account?error=pay-length");
  if (next !== confirm) redirect("/account?error=pay-mismatch");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/account?error=invalid");
  if (user.paymentPasswordHash) {
    if (!current || !(await bcrypt.compare(current, user.paymentPasswordHash))) {
      redirect("/account?error=pay-current");
    }
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { paymentPasswordHash: await bcrypt.hash(next, 10) },
  });
  redirect("/account?pay=1");
}

export async function changeLoginPassword(formData: FormData) {
  const session = await requireMerchant();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next.length < 8) redirect("/account?error=login-length");
  if (next !== confirm) redirect("/account?error=login-mismatch");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
    redirect("/account?error=login-current");
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  await createSession(session);
  redirect("/account?login=1");
}
