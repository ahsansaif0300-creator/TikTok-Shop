"use client";

import { deleteOpsUser } from "@/lib/actions/admin";

export function DeleteOpsUserButton({ userId, username }: { userId: string; username: string }) {
  return (
    <form
      action={deleteOpsUser}
      onSubmit={(event) => {
        if (!confirm(`Delete ${username}? They will no longer be able to sign in.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="text-sm font-medium text-rose-700 hover:underline">
        Delete
      </button>
    </form>
  );
}
