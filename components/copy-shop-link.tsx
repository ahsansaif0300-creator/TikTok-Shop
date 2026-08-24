"use client";

import { useState } from "react";

export function CopyShopLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-soft"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          const field = document.createElement("textarea");
          field.value = url;
          document.body.appendChild(field);
          field.select();
          document.execCommand("copy");
          field.remove();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
