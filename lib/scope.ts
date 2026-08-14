import type { SessionUser } from "@/lib/auth";

export function merchantScope(session: SessionUser) {
  if (session.role === "MERCHANT") {
    return session.merchantId ? { merchantId: session.merchantId } : { merchantId: "__none__" };
  }
  return {};
}

export function canAccessMerchant(session: SessionUser, merchantId: string) {
  if (session.role !== "MERCHANT") return true;
  return session.merchantId === merchantId;
}
