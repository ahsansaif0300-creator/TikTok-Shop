export {
  threadForMerchant,
  postSupportMessage,
  notifyServiceCounterpart,
  expireStaleSupportSessions,
  openStoreServiceSession,
  activeSessionForMerchant,
  markStoreWaiting,
} from "@/lib/service-session";
import { markStoreWaiting, openStoreServiceSession } from "@/lib/service-session";

export async function ensureServiceWelcome(
  merchantId: string,
  storeName: string,
  storeId: string,
  userName: string,
) {
  const opened = await openStoreServiceSession(merchantId, storeName, storeId, userName);
  return opened.thread;
}

export async function botAfterStoreMessage(
  thread: { id: string },
  merchant: { id: string; name: string },
  _userName: string,
  body: string,
) {
  await markStoreWaiting(thread.id, merchant.id, `${merchant.name}: ${body}`);
}
