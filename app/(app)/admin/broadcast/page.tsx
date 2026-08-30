import { requireSuperAdmin } from "@/lib/auth";
import { broadcastToStores } from "@/lib/actions/admin";
import { Button, Card, PageHeader } from "@/components/ui";

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const { sent, error } = await searchParams;

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Send notification"
        subtitle="One message is delivered to every store login. Sellers see it under Notifications."
      />
      {sent ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Sent to {sent} store login{sent === "1" ? "" : "s"}.
        </p>
      ) : null}
      {error === "invalid" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Title and message are required.</p>
      ) : null}
      <Card className="p-5">
        <form action={broadcastToStores} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Recipient</span>
            <select name="audience" className="h-11 w-full rounded-xl border border-line bg-white px-3">
              <option value="all">All stores</option>
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Title</span>
            <input name="title" required maxLength={120} className="h-11 w-full rounded-xl border border-line px-3" />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Message</span>
            <textarea
              name="body"
              required
              rows={5}
              maxLength={2000}
              className="w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          <Button type="submit">Send to all stores</Button>
        </form>
      </Card>
    </div>
  );
}
