import type { OrderStatus } from "@prisma/client";

/** Status-button transitions. SHIPPED is not included — that requires carrier + tracking. */
export const ORDER_BUTTON_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
};

export const ORDER_BUTTON_ACTIONS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }[]>> = {
  PENDING_PAYMENT: [
    { status: "PAID", label: "Mark paid" },
    { status: "CANCELLED", label: "Cancel" },
  ],
  PAID: [
    { status: "PROCESSING", label: "Start processing" },
    { status: "CANCELLED", label: "Cancel" },
  ],
  PROCESSING: [{ status: "CANCELLED", label: "Cancel" }],
  SHIPPED: [{ status: "DELIVERED", label: "Mark delivered" }],
  DELIVERED: [{ status: "COMPLETED", label: "Settle & complete" }],
};

export function canChangeOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
  via: "button" | "ship" = "button",
) {
  if (via === "ship") {
    return to === "SHIPPED" && (from === "PAID" || from === "PROCESSING");
  }
  return (ORDER_BUTTON_TRANSITIONS[from] ?? []).includes(to);
}

export function canOpenRefund(status: OrderStatus) {
  return status !== "PENDING_PAYMENT" && status !== "CANCELLED";
}
