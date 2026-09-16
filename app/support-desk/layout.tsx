import type { ReactNode } from "react";
import { requireSupportDesk } from "@/lib/auth";
import { loadSupportInbox } from "@/lib/support-inbox";
import { toDeskItem } from "@/lib/support-desk";
import { SupportDeskChrome } from "@/components/support-desk-chrome";
import { SupportDeskSidebar } from "@/components/support-desk-sidebar";

export const dynamic = "force-dynamic";

export default async function SupportDeskLayout({ children }: { children: ReactNode }) {
  const session = await requireSupportDesk();
  const inbox = await loadSupportInbox();
  return (
    <SupportDeskChrome session={session}>
      <SupportDeskSidebar
        active={inbox.active.map(toDeskItem)}
        history={inbox.history.map(toDeskItem)}
        stores={inbox.stores}
      />
      {children}
    </SupportDeskChrome>
  );
}
