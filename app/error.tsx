"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-ink">This page could not load</h1>
        <p className="mt-2 text-sm text-muted">
          The server hit an error while opening Harbor. If this happened right after sign-in, Redeploy
          the Node app and confirm <code>DATABASE_URL</code> and <code>AUTH_SECRET</code> are set in
          Hostinger Environment variables.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="h-11 rounded-xl bg-accent px-4 text-sm font-medium text-white"
          >
            Reload
          </button>
          <a
            href="/login"
            className="grid h-11 place-items-center rounded-xl border border-line px-4 text-sm font-medium text-ink"
          >
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
