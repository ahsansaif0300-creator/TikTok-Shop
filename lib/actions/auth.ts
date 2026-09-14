"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureDatabase } from "@/lib/ensure-db";
import { clearSession, createSession, getSession, requireSession } from "@/lib/auth";
import { LOGIN, loginPathForRole } from "@/lib/access";

async function loginWithRole(formData: FormData, expectedRole: Role, failPath: string) {
  const identifier = String(formData.get("email") ?? formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await ensureDatabase();
  } catch (error) {
    console.error("[harbor] login database failed", error);
    redirect(`${failPath}?error=setup`);
  }

  let user: Awaited<ReturnType<typeof prisma.user.findFirst>> | null = null;
  try {
    user = await prisma.user.findFirst({
      where: identifier ? { OR: [{ email: identifier }, { username: identifier }] } : { id: "__none__" },
    });
    if (!user || user.role !== expectedRole || !(await bcrypt.compare(password, user.passwordHash))) {
      user = null;
    }
  } catch (error) {
    console.error("[harbor] login query failed", error);
    redirect(`${failPath}?error=setup`);
  }

  if (!user) redirect(`${failPath}?error=1`);
  if (expectedRole === "MERCHANT" && !user.merchantId) redirect(`${failPath}?error=1`);

  try {
    await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      merchantId: user.merchantId,
    });
  } catch (error) {
    console.error("[harbor] login session failed", error);
    redirect(`${failPath}?error=setup`);
  }

  redirect("/");
}

export async function loginAdminAction(formData: FormData) {
  await loginWithRole(formData, "SUPER_ADMIN", LOGIN.admin);
}

export async function loginOpsAction(formData: FormData) {
  await loginWithRole(formData, "OPS", LOGIN.ops);
}

export async function loginStoreAction(formData: FormData) {
  await loginWithRole(formData, "MERCHANT", LOGIN.store);
}

/** @deprecated Use a role-specific login action. Kept so old forms fail closed. */
export async function loginAction() {
  redirect("/welcome");
}

export async function logoutAction() {
  const session = await getSession();
  const next = session ? loginPathForRole(session.role) : LOGIN.store;
  await clearSession();
  redirect(next);
}

export async function updateProfileAction(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name) redirect("/profile?error=invalid");
  if (password && password.length < 8) redirect("/profile?error=password");

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      name,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });
  await createSession({ ...session, name });
  redirect("/profile?saved=1");
}
