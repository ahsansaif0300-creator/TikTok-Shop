import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/actions/catalog";
import { Button, Card, Empty, PageHeader } from "@/components/ui";

export default async function NotificationsPage() {
  const session = await requireSession();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Ops alerts for applications, payouts, and inventory."
        actions={
          <form action={markNotificationsRead}>
            <Button type="submit" variant="secondary">
              Mark all read
            </Button>
          </form>
        }
      />
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card>
            <Empty title="You're caught up" body="No notifications yet." />
          </Card>
        ) : (
          notifications.map((item) => (
            <a
              key={item.id}
              href={item.href ?? "#"}
              className={`block rounded-2xl border border-line p-4 ${item.read ? "bg-card" : "bg-accent-soft"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted">{format(item.createdAt, "MMM d, HH:mm")}</p>
              </div>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
