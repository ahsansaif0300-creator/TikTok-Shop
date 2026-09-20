"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { ensureDatabase } from "@/lib/ensure-db";
import { uniqueMerchantSlug } from "@/lib/slug";
import { allocateStoreCode } from "@/lib/store-code";
import { fileToDataUrl, idCardError, logoError } from "@/lib/logo";
import { findOpsByReferralCode, isNumericLlcCode, normalizeReferralCode } from "@/lib/referral";
import { DEFAULT_STORE_CREDIT, DEFAULT_STORE_RATING } from "@/lib/store-score";

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
  const referralRaw = String(formData.get("referralCode") ?? "");
  const idFront = formData.get("idFront");
  const idBack = formData.get("idBack");
  const logoUpload = formData.get("logo");

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

  const frontFile = idFront instanceof File ? idFront : null;
  const backFile = idBack instanceof File ? idBack : null;
  const frontProblem = idCardError(frontFile);
  const backProblem = idCardError(backFile);
  if (frontProblem === "missing" || backProblem === "missing") redirect("/signup?error=id");
  if (frontProblem === "type" || backProblem === "type") redirect("/signup?error=id-type");
  if (frontProblem === "size" || backProblem === "size") redirect("/signup?error=id-size");

  const logoFile = logoUpload instanceof File && logoUpload.size > 0 ? logoUpload : null;
  if (logoFile) {
    const logoProblem = logoError(logoFile);
    if (logoProblem === "type") redirect("/signup?error=logo-type");
    if (logoProblem === "size") redirect("/signup?error=logo-size");
  }

  const referralCode = normalizeReferralCode(referralRaw);
  let referrer: Awaited<ReturnType<typeof findOpsByReferralCode>> = null;
  if (referralRaw.trim()) {
    if (!isNumericLlcCode(referralCode)) redirect("/signup?error=referral");
    referrer = await findOpsByReferralCode(referralCode);
    if (!referrer) redirect("/signup?error=referral");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/signup?error=email");

  const starter = await prisma.plan.findFirst({ orderBy: { monthlyFee: "asc" } });
  if (!starter) redirect("/signup?error=setup");

  const slug = await uniqueMerchantSlug(storeName, async (candidate) => {
    const hit = await prisma.merchant.findUnique({ where: { slug: candidate }, select: { id: true } });
    return Boolean(hit);
  });
  const storeCode = await allocateStoreCode();
  const frontUrl = await fileToDataUrl(frontFile!);
  const backUrl = await fileToDataUrl(backFile!);
  const logoUrl = logoFile ? await fileToDataUrl(logoFile) : "";

  const merchant = await prisma.merchant.create({
    data: {
      name: storeName,
      slug,
      storeCode,
      legalName: storeName,
      email,
      phone,
      country,
      city: city || country,
      address: "Address pending",
      status: "PENDING",
      planId: starter.id,
      rating: DEFAULT_STORE_RATING,
      creditScore: DEFAULT_STORE_CREDIT,
      logo: logoUrl,
      cnicImage: frontUrl,
      cnicImageFront: frontUrl,
      cnicImageBack: backUrl,
      referralCodeUsed: referrer?.referralCode ?? "",
      referredByUserId: referrer?.id ?? null,
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

  await prisma.merchantApplication.create({
    data: {
      businessName: storeName,
      contactName,
      email,
      phone,
      country,
      category: "Public signup",
      notes: referrer
        ? `Referred with ${referrer.referralCode} by ${referrer.username || referrer.email}`
        : "Public signup",
      status: "PENDING",
      merchantId: merchant.id,
      referredByUserId: referrer?.id ?? null,
      referralCode: referrer?.referralCode ?? "",
    },
  });
  const reviewers = await prisma.user.findMany({
    where: { role: "OPS" },
    select: { id: true },
  });
  if (reviewers.length > 0) {
    await prisma.notification.createMany({
      data: reviewers.map((user) => ({
        userId: user.id,
        title: "Store waiting for approval",
        body: referrer
          ? `${storeName} signed up with LLC code ${referrer.referralCode}. Review it in Applications.`
          : `${storeName} signed up. Review it in Applications.`,
        href: "/merchants/applications",
      })),
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: referrer ? "merchant:signup-referral" : "merchant:signup",
      entity: "Merchant",
      entityId: merchant.id,
      detail: referrer
        ? `Public signup ${storeName} referred by ${referrer.referralCode} (pending approval)`
        : `Public signup created shop ${storeName} (${slug}) (pending approval)`,
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
