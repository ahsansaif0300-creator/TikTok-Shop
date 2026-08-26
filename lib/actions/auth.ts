"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureDatabase } from "@/lib/ensure-db";
import { clearSession, createSession, requireSession } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const identifier = String(formData.get("email") ?? formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await ensureDatabase();
  } catch (error) {
    console.error("[harbor] login database failed", error);
    redirect("/login?error=setup");
  }

  let user: Awaited<ReturnType<typeof prisma.user.findFirst>> | null = null;
  try {
    user = await prisma.user.findFirst({
      where: identifier ? { OR: [{ email: identifier }, { username: identifier }] } : { id: "__none__" },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      user = null;
    }
  } catch (error) {
    console.error("[harbor] login query failed", error);
    redirect("/login?error=setup");
  }

  if (!user) redirect("/login?error=1");

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
    redirect("/login?error=setup");
  }

  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
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