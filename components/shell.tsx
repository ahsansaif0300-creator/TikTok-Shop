import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { WorkspaceChrome } from "@/components/workspace-chrome";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const [unread, store] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.userId, read: false },
    }),
    session.merchantId
      ? prisma.merchant.findUnique({
          where: { id: session.merchantId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <WorkspaceChrome
      role={session.role}
      name={session.name}
      roleLabel={ROLE_LABEL[session.role]}
      unread={unread}
      storeName={store?.name ?? null}
    >
      {children}
    </WorkspaceChrome>
  );
}
