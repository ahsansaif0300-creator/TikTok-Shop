export const ORDER_STATUS = {
  PENDING_PAYMENT: "Pending payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const MERCHANT_STATUS = {
  PENDING: "Pending",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
} as const;

export const APPLICATION_STATUS = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

export const PRODUCT_STATUS = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
} as const;

export const REFUND_STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
} as const;

export const REFUND_TYPE = {
  REFUND_ONLY: "Refund only",
  RETURN_AND_REFUND: "Return & refund",
  EXCHANGE: "Exchange",
} as const;

export const PAYMENT_RELEASE_STATUS = {
  PENDING: "Pending",
  SCHEDULED: "Scheduled",
  RELEASED: "Released",
} as const;

export const PAYOUT_STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  PAID: "Completed",
  REJECTED: "Rejected",
} as const;

export const SHIPMENT_STATUS = {
  PENDING: "Label created",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  EXCEPTION: "Exception",
} as const;

export const LEDGER_TYPE = {
  SALE: "Sale settlement",
  REFUND: "Refund",
  FEE: "Platform fee",
  PAYOUT: "Payout",
  ADJUSTMENT: "Adjustment",
} as const;

export const ROLE_LABEL = {
  SUPER_ADMIN: "Super admin",
  OPS: "Operations",
  MERCHANT: "Merchant",
} as const;

export const TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
  PENDING: "warning",
  ACTIVE: "success",
  SUSPENDED: "danger",
  APPROVED: "info",
  SCHEDULED: "warning",
  RELEASED: "success",
  REJECTED: "danger",
  DRAFT: "neutral",
  ARCHIVED: "neutral",
  IN_TRANSIT: "info",
  EXCEPTION: "danger",
  PAID_OUT: "success",
  SALE: "success",
  FEE: "neutral",
  PAYOUT: "info",
  ADJUSTMENT: "warning",
  SUPER_ADMIN: "info",
  OPS: "neutral",
  MERCHANT: "success",
};
