import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { LOGIN } from "@/lib/access";
import { applyRuntimeEnv } from "@/lib/runtime-env";
import { displayStaffName } from "@/lib/staff-display";

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  merchantId: string | null;
};

const COOKIE = "harbor_session";

function cookieSecure() {
  const raw = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return process.env.NODE_ENV === "production";
}

function secret() {
  applyRuntimeEnv();
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(user: SessionUser) {
  const session = { ...user, name: displayStaffName(user) };
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function readSessionFromToken(token?: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      merchantId: payload.merchantId ? String(payload.merchantId) : null,
    };
    return { ...user, name: displayStaffName(user) };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionFromToken(store.get(COOKIE)?.value);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect(LOGIN.store);
  }
  return session;
}

export function isStaff(role: Role) {
  return role === "SUPER_ADMIN" || role === "OPS";
}

export function canManageTeam(role: Role) {
  return role === "SUPER_ADMIN";
}

export async function requireMerchant() {
  const session = await getSession();
  if (!session) redirect(LOGIN.store);
  if (session.role !== "MERCHANT" || !session.merchantId) {
    redirect("/");
  }
  return { ...session, merchantId: session.merchantId };
}

export async function requireStaff() {
  const session = await getSession();
  if (!session) redirect(LOGIN.ops);
  if (session.role !== "SUPER_ADMIN" && session.role !== "OPS") {
    redirect("/");
  }
  return session;
}

export async function requireSupportDesk() {
  const session = await getSession();
  if (!session) redirect(LOGIN.support);
  if (session.role !== "SUPER_ADMIN" && session.role !== "OPS") {
    redirect("/");
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) redirect(LOGIN.admin);
  if (session.role !== "SUPER_ADMIN") {
    redirect("/");
  }
  return session;
}
