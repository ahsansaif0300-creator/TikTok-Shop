"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendSupportMessage, startServiceSession } from "@/lib/actions/support";
import { SERVICE_TOPICS } from "@/lib/service-bot";
import { Button } from "@/components/ui";
import type { LiveSupportMessage } from "@/lib/support-live";

export function ServiceComposer({
  merchantId,
  expiresAt,
  showTopics,
  allowRestart,
  locked,
  storeMode,
  live,
  onSent,
}: {
  merchantId?: string;
  expiresAt?: string;
  showTopics?: boolean;
  allowRestart?: boolean;
  locked?: boolean;
  storeMode?: boolean;
  live?: boolean;
  onSent?: (message: LiveSupportMessage) => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const lastTyping = useRef(0);

  useEffect(() => {
    if (locked || !expiresAt) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt, locked]);

  const expired = Boolean(locked) || (expiresAt ? new Date(expiresAt).getTime() <= nowMs : false);

  async function pingTyping() {
    if (!live) return;
    const now = Date.now();
    if (now - lastTyping.current < 700) return;
    lastTyping.current = now;
    await fetch("/api/support/live", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ merchantId, typing: true }),
    }).catch(() => undefined);
  }

  async function sendForm(form: HTMLFormElement, extraBody?: string) {
    const data = new FormData(form);
    if (merchantId) data.set("merchantId", merchantId);
    if (extraBody != null) data.set("body", extraBody);
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/support/live", { method: "POST", body: data });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: LiveSupportMessage };
      if (!json.ok || !json.message) {
        setError(json.error === "expired" ? "expired" : json.error === "type" ? "type" : json.error === "size" ? "size" : "empty");
        return;
      }
      form.reset();
      onSent?.(json.message);
    } catch {
      setError("empty");
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!live) return;
    event.preventDefault();
    await sendForm(event.currentTarget);
  }

  if (expired) {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-sm text-muted">
          {storeMode
            ? "This support chat has ended. Your messages stay saved."
            : "This service hour ended. The store left the active list. Chat history stays saved."}
        </p>
        {allowRestart ? (
          <form action={startServiceSession}>
            <Button type="submit">Start new chat</Button>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {error === "empty" ? <p className="text-sm text-rose-700">Write a message or attach a file.</p> : null}
      {error === "type" ? <p className="text-sm text-rose-700">Use a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file.</p> : null}
      {error === "size" ? <p className="text-sm text-rose-700">Images must be under 5 MB and videos under 20 MB.</p> : null}
      {error === "expired" ? <p className="text-sm text-rose-700">This support chat ended. Start a new chat to continue.</p> : null}
      {showTopics ? (
        <div className="flex flex-wrap gap-2">
          {SERVICE_TOPICS.map((topic) => (
            <form
              action={live ? undefined : sendSupportMessage}
              onSubmit={
                live
                  ? (event) => {
                      event.preventDefault();
                      void sendForm(event.currentTarget, topic.label);
                    }
                  : undefined
              }
              key={topic.id}
            >
              {merchantId ? <input type="hidden" name="merchantId" value={merchantId} /> : null}
              <input type="hidden" name="body" value={topic.label} />
              <Button type="submit" variant="secondary" disabled={sending}>
                {topic.label}
              </Button>
            </form>
          ))}
        </div>
      ) : null}
      <form action={live ? undefined : sendSupportMessage} onSubmit={live ? onSubmit : undefined} className="space-y-3">
        {merchantId ? <input type="hidden" name="merchantId" value={merchantId} /> : null}
        <textarea
          name="body"
          rows={3}
          placeholder="Type your message..."
          onChange={() => {
            void pingTyping();
          }}
          className="w-full rounded-xl border border-line p-3 text-sm outline-none ring-accent/30 focus:ring-2"
        />
        <label className="block text-sm">
          <span className="font-medium">Upload Image/Video</span>
          <input
            name="media"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
          />
          <span className="mt-1 block text-xs text-muted">
            Images up to 5 MB (JPG, PNG, WebP, GIF). Videos up to 20 MB (MP4, WebM, MOV).
          </span>
        </label>
        <Button type="submit" disabled={sending}>
          {sending ? "Sending…" : merchantId && !storeMode ? "Send reply" : "Send"}
        </Button>
      </form>
    </div>
  );
}
