import { format } from "date-fns";
import { formatRemaining } from "@/lib/service-time";
import { Card } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  INTAKE: "Assistant intake",
  WAITING_AGENT: "Waiting for support",
  WITH_AGENT: "With support team",
};

export function SupportStoreDetails({
  store,
  threadStatus,
  agentName,
  session,
  now,
}: {
  store: {
    name: string;
    storeCode: string | null;
    id: string;
    slug: string;
    email: string;
    phone: string;
    city: string;
    country: string;
    status: string;
    legalName?: string | null;
  };
  threadStatus: string;
  agentName?: string | null;
  session?: { startedAt: Date; expiresAt: Date } | null;
  now: Date;
}) {
  const expired = !session || session.expiresAt.getTime() <= now.getTime();
  return (
    <Card className="mb-4 space-y-1 p-5 text-sm">
      <p>
        <span className="text-muted">Store name</span> <span className="font-medium text-ink">{store.name}</span>
      </p>
      {store.legalName ? (
        <p>
          <span className="text-muted">Legal name</span> {store.legalName}
        </p>
      ) : null}
      <p>
        <span className="text-muted">Store ID</span>{" "}
        <span className="font-mono text-ink">{store.storeCode || store.id}</span>
      </p>
      <p>
        <span className="text-muted">Shop slug</span> <span className="font-mono text-ink">{store.slug}</span>
      </p>
      <p>
        <span className="text-muted">Contact</span> {store.email || "—"} · {store.phone || "—"}
      </p>
      <p>
        <span className="text-muted">Location</span> {[store.city, store.country].filter(Boolean).join(", ") || "—"}
      </p>
      <p>
        <span className="text-muted">Store status</span> {store.status}
      </p>
      <p>
        <span className="text-muted">Chat status</span>{" "}
        {expired ? "Expired — saved in history" : (STATUS_LABEL[threadStatus] ?? threadStatus)}
      </p>
      {session ? (
        <>
          <p>
            <span className="text-muted">Session start</span> {format(session.startedAt, "MMM d, yyyy HH:mm")}
          </p>
          <p>
            <span className="text-muted">Session expiry</span> {format(session.expiresAt, "MMM d, yyyy HH:mm")}
            {!expired ? ` · Remaining ${formatRemaining(session.expiresAt.getTime() - now.getTime())}` : ""}
          </p>
        </>
      ) : (
        <p className="text-muted">No active hour. Previous messages remain below.</p>
      )}
      {agentName ? (
        <p>
          <span className="text-muted">You</span> {agentName}
        </p>
      ) : null}
    </Card>
  );
}
