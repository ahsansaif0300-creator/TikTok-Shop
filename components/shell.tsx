import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { shopAbsoluteUrl } from "@/lib/shop-url";
import { processDueReleases } from "@/lib/process-releases";
import { WorkspaceChrome } from "@/components/workspace-chrome";
import { StorePendingReview } from "@/components/store-pending-review";
import { displayStaffName } from "@/lib/staff-display";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await requireSession();
  await processDueReleases();
  const [unread, store] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.userId, read: false },
    }),
    session.merchantId
      ? prisma.merchant.findUnique({
          where: { id: session.merchantId },
          select: { name: true, slug: true, status: true },
        })
      : Promise.resolve(null),
  ]);

  if (session.role === "MERCHANT" && store?.status === "PENDING") {
    return <StorePendingReview storeName={store.name} />;
  }

  const shopUrl = store?.slug ? await shopAbsoluteUrl(store.slug) : null;

  return (
    <WorkspaceChrome
      role={session.role}
      name={displayStaffName(session)}
      roleLabel={ROLE_LABEL[session.role]}
      unread={unread}
      storeName={store?.name ?? null}
      shopUrl={shopUrl}
    >
      {children}
    </WorkspaceChrome>
  );
}
