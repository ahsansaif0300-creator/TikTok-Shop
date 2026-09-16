"use client";

import { useEffect, useState } from "react";
import { sendSupportMessage, startServiceSession } from "@/lib/actions/support";
import { SERVICE_TOPICS } from "@/lib/service-bot";
import { Button } from "@/components/ui";

export function ServiceComposer({
  merchantId,
  expiresAt,
  showTopics,
  allowRestart,
  locked,
  storeMode,
}: {
  merchantId?: string;
  expiresAt?: string;
  showTopics?: boolean;
  allowRestart?: boolean;
  locked?: boolean;
  storeMode?: boolean;
}) {
  const [expired, setExpired] = useState(
    () => Boolean(locked) || (expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false),
  );

  useEffect(() => {
    if (locked) {
      setExpired(true);
      return;
    }
    if (!expiresAt) {
      setExpired(false);
      return;
    }
    const end = expiresAt;
    function tick() {
      setExpired(new Date(end).getTime() <= Date.now());
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, locked]);

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
      {showTopics ? (
        <div className="flex flex-wrap gap-2">
          {SERVICE_TOPICS.map((topic) => (
            <form action={sendSupportMessage} key={topic.id}>
              {merchantId ? <input type="hidden" name="merchantId" value={merchantId} /> : null}
              <input type="hidden" name="body" value={topic.label} />
              <Button type="submit" variant="secondary">
                {topic.label}
              </Button>
            </form>
          ))}
        </div>
      ) : null}
      <form action={sendSupportMessage} className="space-y-3">
        {merchantId ? <input type="hidden" name="merchantId" value={merchantId} /> : null}
        <textarea
          name="body"
          rows={3}
          placeholder="Type your message..."
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
        <Button type="submit">{merchantId ? "Send reply" : "Send"}</Button>
      </form>
    </div>
  );
}
