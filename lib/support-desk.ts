import type { SupportInboxRow } from "@/lib/support-inbox";
import type { SupportDeskListItem } from "@/components/support-desk-sidebar";

function lastPreview(body: string, kind: string) {
  if (kind === "IMAGE") return body ? `${body} · image` : "Image";
  if (kind === "VIDEO") return body ? `${body} · video` : "Video";
  return body || "No messages yet.";
}

export function toDeskItem(item: SupportInboxRow): SupportDeskListItem {
  const last = item.messages[0];
  return {
    id: item.id,
    merchantId: item.merchantId,
    startedAt: item.startedAt.toISOString(),
    expiresAt: item.expiresAt.toISOString(),
    waiting: item.thread.status === "WAITING_AGENT",
    lastPreview: last ? lastPreview(last.body, last.attachmentKind) : "Welcome sent.",
    store: {
      name: item.thread.merchant.name,
      storeCode: item.thread.merchant.storeCode,
      id: item.thread.merchant.id,
      city: item.thread.merchant.city,
      email: item.thread.merchant.email,
      phone: item.thread.merchant.phone,
    },
  };
}
