"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canManageTeam, isStaff, requireSession } from "@/lib/auth";

export async function createTeamUser(formData: FormData) {
  const session = await requireSession();
  if (!canManageTeam(session.role)) throw new Error("Forbidden");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "OPS");
  if (!name || !email || !password) redirect("/users?error=invalid");
  if (password.length < 8) redirect("/users?error=password");
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) redirect("/users?error=email");
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "OPS",
    },
  });
  revalidatePath("/users");
  redirect("/users?created=1");
}

export async function createStoreUser(formData: FormData) {
  const session = await requireSession();
  if (!isStaff(session.role)) throw new Error("Forbidden");
  const merchantId = String(formData.get("merchantId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!merchantId) redirect("/");
  if (!name || !email || !password) redirect(`/merchants/${merchantId}?error=invalid`);
  if (password.length < 8) redirect(`/merchants/${merchantId}?error=password`);
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) redirect("/");
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) redirect(`/merchants/${merchantId}?error=email`);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "MERCHANT",
      merchantId: merchant.id,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "user:merchant",
      entity: "User",
      entityId: merchant.id,
      detail: `Created store login ${email} for ${merchant.name}`,
    },
  });
  revalidatePath(`/merchants/${merchantId}`);
  redirect(`/merchants/${merchantId}?created=1`);
}
