"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { applyRuntimeEnv } from "@/lib/runtime-env";
import { prisma } from "@/lib/db";
import { ensureDatabase } from "@/lib/ensure-db";
import { clearSession, createSession, getSession, isStaff, requireSession } from "@/lib/auth";
import { LOGIN, loginPathForRole } from "@/lib/access";

const LOGIN_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  name: true,
  passwordHash: true,
  role: true,
  merchantId: true,
} as const;

type LoginUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  passwordHash: string;
  role: Role;
  merchantId: string | null;
};

async function findLoginUser(identifier: string): Promise<LoginUser | null> {
  if (!identifier) return null;
  try {
    return await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: LOGIN_USER_SELECT,
    });
  } catch (error) {
    console.warn("[harbor] login lookup with username failed; retrying email only", error);
    return prisma.user.findFirst({
      where: { email: identifier },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
        merchantId: true,
      },
    }).then((user) => (user ? { ...user, username: null } : null));
  }
}

async function prepareLogin() {
  applyRuntimeEnv();
  try {
    await ensureDatabase();
  } catch (error) {
    console.error("[harbor] login database failed", error);
  }
}

async function loginWithRole(formData: FormData, expectedRole: Role, failPath: string) {
  const identifier = String(formData.get("email") ?? formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  await prepareLogin();

  let user: LoginUser | null = null;
  try {
    user = await findLoginUser(identifier);
  } catch (error) {
    console.error("[harbor] login query failed", error);
    try {
      await ensureDatabase();
      user = await findLoginUser(identifier);
    } catch (retryError) {
      console.error("[harbor] login query retry failed", retryError);
      redirect(`${failPath}?error=setup`);
    }
  }

  if (!user || user.role !== expectedRole || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect(`${failPath}?error=1`);
  }
  if (expectedRole === "MERCHANT" && !user.merchantId) redirect(`${failPath}?error=1`);

  try {
    applyRuntimeEnv();
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

export async function loginSupportAction(formData: FormData) {
  const identifier = String(formData.get("email") ?? formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  await prepareLogin();

  let user: LoginUser | null = null;
  try {
    user = await findLoginUser(identifier);
  } catch (error) {
    console.error("[harbor] support login query failed", error);
    try {
      await ensureDatabase();
      user = await findLoginUser(identifier);
    } catch (retryError) {
      console.error("[harbor] support login query retry failed", retryError);
      redirect(`${LOGIN.support}?error=setup`);
    }
  }

  if (!user || !isStaff(user.role) || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect(`${LOGIN.support}?error=1`);
  }

  try {
    applyRuntimeEnv();
    await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      merchantId: user.merchantId,
    });
  } catch (error) {
    console.error("[harbor] support login session failed", error);
    redirect(`${LOGIN.support}?error=setup`);
  }

  redirect("/support-desk");
}

export async function logoutSupportAction() {
  await clearSession();
  redirect(LOGIN.support);
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
