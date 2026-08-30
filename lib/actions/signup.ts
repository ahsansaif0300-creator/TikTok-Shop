"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { ensureDatabase } from "@/lib/ensure-db";
import { uniqueMerchantSlug } from "@/lib/slug";

export async function signupMerchantAction(formData: FormData) {
  const storeName = String(formData.get("storeName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

  try {
    await ensureDatabase();
  } catch (error) {
    console.error("[harbor] signup database failed", error);
    redirect("/signup?error=setup");
  }

  if (!storeName || !contactName || !email || !password || !country) {
    redirect("/signup?error=invalid");
  }
  if (password.length < 8) redirect("/signup?error=password");
  if (confirm && confirm !== password) redirect("/signup?error=mismatch");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/signup?error=email");

  const starter = await prisma.plan.findFirst({ orderBy: { monthlyFee: "asc" } });
  if (!starter) redirect("/signup?error=setup");

  const slug = await uniqueMerchantSlug(storeName, async (candidate) => {
    const hit = await prisma.merchant.findUnique({ where: { slug: candidate }, select: { id: true } });
    return Boolean(hit);
  });

  const merchant = await prisma.merchant.create({
    data: {
      name: storeName,
      slug,
      legalName: storeName,
      email,
      phone,
      country,
      city: city || country,
      address: "Address pending",
      status: "ACTIVE",
      planId: starter.id,
    },
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: contactName,
      email,
      passwordHash,
      paymentPasswordHash: passwordHash,
      role: "MERCHANT",
      merchantId: merchant.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "merchant:signup",
      entity: "Merchant",
      entityId: merchant.id,
      detail: `Public signup created shop ${storeName} (${slug})`,
    },
  });

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    merchantId: user.merchantId,
  });

  redirect("/");
}
