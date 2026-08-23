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

/** Merchants cannot choose another store, even if the form posts a different merchantId. */
export function catalogMerchantId(session: SessionUser, formMerchantId: string) {
  if (session.role === "MERCHANT") return session.merchantId;
  return formMerchantId || null;
}
