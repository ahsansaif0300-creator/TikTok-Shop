"use server";

import { revalidatePath } from "next/cache";
import type { MerchantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function setMerchantStatus(merchantId: string, status: MerchantStatus) {
  const session = await requireSession();
  if (!isStaff(session.role)) throw new Error("Forbidden");
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
  await prisma.merchant.update({ where: { id: merchantId }, data: { planId } });
  revalidatePath(`/merchants/${merchantId}`);
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
    revalidatePath("/", "layout");
    return;
  }

  const starter = await prisma.plan.findFirst({ orderBy: { monthlyFee: "asc" } });
  if (!starter) throw new Error("No seller plan configured");

  const merchant = await prisma.merchant.create({
    data: {
      name: application.businessName,
      slug: `${slugify(application.businessName)}-${Date.now().toString(36)}`,
      legalName: application.businessName,
      email: application.email,
      phone: application.phone,
      country: application.country,
      city: "",
      address: "",
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
  revalidatePath("/", "layout");
}
