"use client";

import { useEffect, useRef, useState } from "react";
import { ServiceComposer } from "@/components/service-composer";
import { ServiceMessageBubble } from "@/components/service-message-bubble";
import type { LiveSupportMessage } from "@/lib/support-live";

export function SupportLiveChat({
  merchantId,
  initialMessages,
  expiresAt,
  locked,
  storeMode,
  showTopics,
  allowRestart,
  selfUserId,
}: {
  merchantId: string;
  initialMessages: LiveSupportMessage[];
  expiresAt?: string;
  locked?: boolean;
  storeMode?: boolean;
  showTopics?: boolean;
  allowRestart?: boolean;
  selfUserId?: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [typing, setTyping] = useState<string | null>(null);
  const [liveExpiresAt, setLiveExpiresAt] = useState(expiresAt);
  const [liveLocked, setLiveLocked] = useState(Boolean(locked));
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, typing]);

  useEffect(() => {
    let stop = false;
    async function pull() {
      const res = await fetch(`/api/support/live?merchantId=${encodeURIComponent(merchantId)}`, { cache: "no-store" });
      if (!res.ok || stop) return;
      const ctype = res.headers.get("content-type") || "";
      if (!ctype.includes("application/json")) return;
      const json = (await res.json()) as {
        thread?: {
          messages: LiveSupportMessage[];
          expired: boolean;
          expiresAt: string | null;
          typing: { store: string | null; agent: string | null };
        };
      };
      if (stop || !json.thread) return;
      setMessages(json.thread.messages);
      setLiveExpiresAt(json.thread.expiresAt ?? undefined);
      setLiveLocked(json.thread.expired);
      const other = storeMode ? json.thread.typing.agent : json.thread.typing.store;
      setTyping(other);
    }
    void pull();
    const id = setInterval(() => {
      if (document.hidden) return;
      void pull();
    }, 1200);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [merchantId, storeMode]);

  return (
    <div>
      <div ref={scroller} className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">
            {storeMode ? "No messages yet." : "No messages yet. They appear here as soon as the store writes in Service."}
          </p>
        ) : (
          messages.map((message) => (
            <ServiceMessageBubble
              key={message.id}
              id={message.id}
              sender={message.sender}
              userName={message.userName}
              body={message.body}
              createdAt={message.createdAt}
              attachmentKind={message.attachmentKind}
              highlight={
                storeMode
                  ? message.sender === "STORE"
                  : message.sender === "AGENT" && (!selfUserId || message.userId === selfUserId)
              }
            />
          ))
        )}
        {typing ? (
          <div className="rounded-xl bg-soft px-3 py-2 text-sm text-muted">
            <p className="flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted" />
              </span>
              {typing} is typing…
            </p>
          </div>
        ) : null}
      </div>
      <ServiceComposer
        merchantId={merchantId}
        expiresAt={liveExpiresAt}
        locked={liveLocked}
        showTopics={showTopics}
        allowRestart={allowRestart}
        storeMode={storeMode}
        live
        onSent={(message) => {
          setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
          setTyping(null);
        }}
      />
    </div>
  );
}
