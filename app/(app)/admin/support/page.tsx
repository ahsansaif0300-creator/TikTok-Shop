import { requireSuperAdmin } from "@/lib/auth";
import { loadSupportInbox } from "@/lib/support-inbox";
import { SupportBackendInbox } from "@/components/support-backend-inbox";

export default async function AdminSupportInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSuperAdmin();
  const { error } = await searchParams;
  const inbox = await loadSupportInbox();
  return (
    <SupportBackendInbox
      title="Support Service"
      subtitle="Dedicated Main Backend inbox. Every store message shows Store name, Store ID, and contact. The 1-hour timer is on the open chat. When time ends the chat leaves Active and stays in history."
      threadBase="/admin/support"
      active={inbox.active}
      history={inbox.history}
      stores={inbox.stores}
      now={inbox.now}
      error={error}
    />
  );
}
