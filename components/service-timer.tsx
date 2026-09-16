"use client";

import { useEffect, useState } from "react";
import { formatRemaining } from "@/lib/service-time";

export function ServiceTimer({ expiresAt, reloadOnExpire }: { expiresAt: string; reloadOnExpire?: boolean }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const remaining = new Date(expiresAt).getTime() - nowMs;

  useEffect(() => {
    let reloaded = false;
    const id = setInterval(() => {
      const next = Date.now();
      setNowMs(next);
      if (reloadOnExpire && new Date(expiresAt).getTime() - next <= 0 && !reloaded) {
        reloaded = true;
        window.location.reload();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, reloadOnExpire]);

  if (remaining <= 0) {
    return (
      <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <p className="font-medium">Service Session Expired</p>
        <p className="mt-0.5 text-xs">This hour is over. Chat history is saved. Start a new session to keep talking.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-soft px-3 py-2 text-sm text-ink">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">Time Remaining</p>
      <p className="mt-1 font-mono text-lg font-semibold">{formatRemaining(remaining)}</p>
    </div>
  );
}
