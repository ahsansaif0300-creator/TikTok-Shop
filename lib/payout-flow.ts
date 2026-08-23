import type { PayoutStatus } from "@prisma/client";

export type PayoutDecision = "APPROVED" | "REJECTED" | "PAID";

export function canDecidePayout(from: PayoutStatus, action: PayoutDecision) {
  if (action === "APPROVED") return from === "PENDING";
  if (action === "REJECTED") return from === "PENDING" || from === "APPROVED";
  if (action === "PAID") return from === "APPROVED";
  return false;
}
