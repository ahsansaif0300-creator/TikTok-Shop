"use server";

import { revalidatePath } from "next/cache";
import type { MerchantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { uniqueMerchantSlug } from "@/lib/slug";

export async function setMerchantStatus(merchantId: string, status: MerchantStatus) {
  const session = await requireSession();
  if (!isStaff(session.role)) throw new Error("Forbidden");
  if (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "PENDING") {
    throw new Error("Invalid merchant status");
  }
  await prisma.merchant.update({ where: { id: merchantId }, data: { status } });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: `merchant:${status}`,
      entity: "Merchant",
      entityId: merchantId,
      detail: `Set merchant status to ${status}`,
    },
  });
  revalidatePath("/", "layout");
}

export async function assignPlan(formData: FormData) {
  const session = await requireSession();
  if (!isStaff(session.role)) throw new Error("Forbidden");
  const merchantId = String(formData.get("merchantId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!merchantId || !plan) return;
  await prisma.merchant.update({ where: { id: merchantId }, data: { planId: plan.id } });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "merchant:plan",
      entity: "Merchant",
      entityId: merchantId,
      detail: `Assigned plan ${plan.name}`,
    },
  });
  revalidatePath(`/merchants/${merchantId}`);
}

export async function createApplication(formData: FormData) {
  const session = await requireSession();
  if (!isStaff(session.role)) throw new Error("Forbidden");
  const businessName = String(formData.get("businessName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!businessName || !contactName || !email || !country || !category) return;

  await prisma.merchantApplication.create({
    data: { businessName, contactName, email, phone, country, category, notes },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "application:create",
      entity: "MerchantApplication",
      entityId: email,
      detail: `Logged inbound application for ${businessName}`,
    },
  });
  revalidatePath("/merchants/applications");
}

export async function reviewApplication(formData: FormData) {
  const session = await requireSession();
  if (!isStaff(session.role)) throw new Error("Forbidden");
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();
  const application = await prisma.merchantApplication.findUnique({ where: { id } });
  if (!application || application.status !== "PENDING") return;

  if (decision === "REJECTED") {
    await prisma.merchantApplication.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewNote,
        reviewerId: session.userId,
        reviewedAt: new Date(),
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "application:REJECTED",
        entity: "MerchantApplication",
        entityId: id,
        detail: `Rejected ${application.businessName}`,
      },
    });
    revalidatePath("/", "layout");
    return;
  }

  if (decision !== "APPROVED") return;

  const starter = await prisma.plan.findFirst({ orderBy: { monthlyFee: "asc" } });
  if (!starter) throw new Error("No seller plan configured");

  const merchant = await prisma.merchant.create({
    data: {
      name: application.businessName,
      slug: await uniqueMerchantSlug(application.businessName, async (candidate) => {
        const hit = await prisma.merchant.findUnique({ where: { slug: candidate }, select: { id: true } });
        return Boolean(hit);
      }),
      legalName: application.businessName,
      email: application.email,
      phone: application.phone,
      country: application.country,
      city: application.country,
      address: "Onboarding — address pending",
      status: "ACTIVE",
      planId: starter.id,
    },
  });

  await prisma.merchantApplication.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewNote,
      reviewerId: session.userId,
      reviewedAt: new Date(),
      merchantId: merchant.id,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "application:APPROVED",
      entity: "MerchantApplication",
      entityId: id,
      detail: `Approved ${application.businessName} on ${starter.name}`,
    },
  });
  revalidatePath("/", "layout");
}
