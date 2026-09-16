type Side = "STORE" | "AGENT";

type Entry = { name: string; until: number };

const TYPING_MS = 2_800;
const typing = new Map<string, Partial<Record<Side, Entry>>>();

export function setSupportTyping(merchantId: string, side: Side, name: string) {
  const row = typing.get(merchantId) ?? {};
  row[side] = { name, until: Date.now() + TYPING_MS };
  typing.set(merchantId, row);
}

export function clearSupportTyping(merchantId: string, side: Side) {
  const row = typing.get(merchantId);
  if (!row) return;
  delete row[side];
  if (!row.STORE && !row.AGENT) typing.delete(merchantId);
}

export function readSupportTyping(merchantId: string) {
  const row = typing.get(merchantId);
  const now = Date.now();
  const store = row?.STORE && row.STORE.until > now ? row.STORE.name : null;
  const agent = row?.AGENT && row.AGENT.until > now ? row.AGENT.name : null;
  return { store, agent };
}
