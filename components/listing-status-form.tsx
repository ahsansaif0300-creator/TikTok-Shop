import { setProductListingStatus } from "@/lib/actions/catalog";
import { LISTING_STATUS } from "@/lib/product-listing";
import { cn } from "@/lib/utils";
import type { ProductListingStatus } from "@prisma/client";

export function ListingStatusForm({
  productId,
  value,
  returnTo,
}: {
  productId: string;
  value: ProductListingStatus;
  returnTo?: string;
}) {
  return (
    <form action={setProductListingStatus} className="mt-3">
      <input type="hidden" name="productId" value={productId} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <p className="text-[11px] uppercase tracking-wide text-muted">Listing status</p>
      <p className="mt-1 text-sm font-medium text-ink">{LISTING_STATUS[value]}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="submit"
          name="listingStatus"
          value="ON_SHELF"
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-medium ring-1",
            value === "ON_SHELF"
              ? "bg-amber-50 text-amber-900 ring-amber-200"
              : "bg-white text-ink ring-line hover:bg-soft",
          )}
        >
          On Shelf
        </button>
        <button
          type="submit"
          name="listingStatus"
          value="LISTED"
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-medium ring-1",
            value === "LISTED"
              ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
              : "bg-white text-ink ring-line hover:bg-soft",
          )}
        >
          Listed
        </button>
      </div>
    </form>
  );
}
