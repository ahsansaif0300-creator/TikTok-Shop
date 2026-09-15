import { format } from "date-fns";

function senderLabel(sender: string, name?: string | null) {
  if (sender === "BOT") return "TikiTok Shop Service assistant";
  if (sender === "AGENT") return `${name ?? "Support"} · team`;
  return `${name ?? "Store"} · store`;
}

export function ServiceMessageBubble({
  id,
  sender,
  userName,
  body,
  createdAt,
  attachmentKind,
  highlight,
}: {
  id: string;
  sender: string;
  userName?: string | null;
  body: string;
  createdAt: Date;
  attachmentKind?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl px-3 py-2 text-sm ${highlight ? "bg-accent-soft text-ink" : "bg-soft"}`}>
      <p className="text-xs text-muted">
        {senderLabel(sender, userName)} · {format(createdAt, "MMM d, HH:mm")}
      </p>
      {body ? <p className="mt-1 whitespace-pre-wrap">{body}</p> : null}
      {attachmentKind === "IMAGE" ? (
        <img src={`/service/media/${id}`} alt="Support upload" className="mt-2 max-h-64 w-auto rounded-lg border border-line" />
      ) : null}
      {attachmentKind === "VIDEO" ? (
        <video src={`/service/media/${id}`} controls className="mt-2 max-h-64 w-full rounded-lg border border-line" />
      ) : null}
    </div>
  );
}
