import { setProductListingStatus } from "@/lib/actions/catalog";
import { LISTING_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ProductListingStatus } from "@prisma/client";

function Fields({
  productId,
  returnTo,
}: {
  productId: string;
  returnTo?: string;
}) {
  return (
    <>
      <input type="hidden" name="productId" value={productId} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
    </>
  );
}

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
    <div className="mt-4 rounded-xl border border-line bg-white p-3">
      <p className="text-sm font-semibold text-ink">Status: {LISTING_STATUS[value]}</p>
      <form action={setProductListingStatus} method="post" className="mt-2">
        <Fields productId={productId} returnTo={returnTo} />
        <label className="block space-y-1.5">
          <span className="sr-only">Change status</span>
          <select
            name="listingStatus"
            defaultValue={value}
            className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink"
          >
            <option value="ON_SHELF">On Shelf</option>
            <option value="LISTED">Listed</option>
          </select>
        </label>
        <button
          type="submit"
          className="mt-2 h-11 w-full rounded-xl bg-ink text-sm font-semibold text-white hover:bg-black"
        >
          Save status
        </button>
      </form>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <form action={setProductListingStatus} method="post">
          <Fields productId={productId} returnTo={returnTo} />
          <input type="hidden" name="listingStatus" value="ON_SHELF" />
          <button
            type="submit"
            className={cn(
              "h-11 w-full rounded-xl text-sm font-semibold ring-1",
              value === "ON_SHELF"
                ? "bg-amber-100 text-amber-950 ring-amber-300"
                : "bg-soft text-ink ring-line hover:bg-white",
            )}
          >
            On Shelf
          </button>
        </form>
        <form action={setProductListingStatus} method="post">
          <Fields productId={productId} returnTo={returnTo} />
          <input type="hidden" name="listingStatus" value="LISTED" />
          <button
            type="submit"
            className={cn(
              "h-11 w-full rounded-xl text-sm font-semibold ring-1",
              value === "LISTED"
                ? "bg-emerald-100 text-emerald-950 ring-emerald-300"
                : "bg-soft text-ink ring-line hover:bg-white",
            )}
          >
            Listed
          </button>
        </form>
      </div>
    </div>
  );
}
