import { logoutAction } from "@/lib/actions/auth";
import { AuthFrame } from "@/components/auth-frame";
import { BRAND_NAME } from "@/lib/brand-name";

export function StorePendingReview({ storeName }: { storeName: string }) {
  return (
    <AuthFrame
      title="Your store approval is in review"
      subtitle={`${BRAND_NAME} has your signup. Please wait until review is complete — the store dashboard opens only after approval.`}
    >
      <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-4 text-sm text-amber-950">
        <p className="font-semibold">{storeName || "Your store"}</p>
        <p className="mt-1 text-amber-900/80">
          You can sign out and come back later. After approval, sign in again to choose products and start selling.
        </p>
      </div>
      <form action={logoutAction} className="mt-6">
        <button className="h-11 w-full rounded-xl border border-line text-sm font-semibold text-ink hover:bg-soft">
          Sign out
        </button>
      </form>
    </AuthFrame>
  );
}
