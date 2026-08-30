export const SERVICE_TOPICS = [
  { id: "orders", label: "Orders & pickup" },
  { id: "finance", label: "Balance & withdrawal" },
  { id: "catalog", label: "Products & shipping" },
  { id: "other", label: "Something else" },
] as const;

export type ServiceTopicId = (typeof SERVICE_TOPICS)[number]["id"];

const FOLLOW_UP: Record<string, string> = {
  "Orders & pickup": "Which order is this about, and what should happen next? You can paste an order number like HB-2026-10001.",
  "Balance & withdrawal": "What should we look at — available balance, a recharge, or a withdrawal request? Include the amount if you know it.",
  "Products & shipping": "Which product or shipment needs help? A SKU or tracking number is enough.",
  "Something else": "In one or two sentences, what do you need the support team to do?",
};

export function welcomeBody(storeName: string, storeId: string, userName: string) {
  return [
    `Hi ${userName} — this is the Harbor Service assistant.`,
    `You're already identified as ${storeName}. Store ID ${storeId} is attached to this chat, so you don't need to type your store name or ID.`,
    "I'll ask a couple of basic questions, then a support team member will take over.",
    "What do you need help with today?",
  ].join(" ");
}

export function matchTopic(text: string) {
  const lower = text.trim().toLowerCase();
  const exact = SERVICE_TOPICS.find((topic) => topic.label.toLowerCase() === lower);
  if (exact) return exact.label;
  if (/\border|pickup|pick up\b/.test(lower)) return "Orders & pickup";
  if (/\bbalance|withdraw|recharge|payout|fund\b/.test(lower)) return "Balance & withdrawal";
  if (/\bproduct|ship|sku|stock|catalog\b/.test(lower)) return "Products & shipping";
  return "Something else";
}

export function detailsPrompt(topicLabel: string) {
  return `Thanks. I already have the store on file. ${FOLLOW_UP[topicLabel] ?? FOLLOW_UP["Something else"]}`;
}

export function handoffBody(storeName: string, storeId: string, userName: string, topic: string, detail: string) {
  return [
    "Thanks — that's enough for the team.",
    `Summary for support: Store ${storeName} (${storeId}), contact ${userName}, topic ${topic}.`,
    `Notes: ${detail}`,
    "A support team member will continue this conversation from here.",
  ].join(" ");
}
