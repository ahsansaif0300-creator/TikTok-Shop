import { updateStoreScore } from "@/lib/actions/admin";
import { Button } from "@/components/ui";
import { formatStoreRating, STORE_RATING_MAX, STORE_RATING_MIN } from "@/lib/store-score";

export function StoreScoreForm({
  merchantId,
  storeName,
  rating,
  creditScore,
}: {
  merchantId: string;
  storeName: string;
  rating: number;
  creditScore: number;
}) {
  return (
    <form action={updateStoreScore} className="space-y-3">
      <input type="hidden" name="merchantId" value={merchantId} />
      <p className="text-sm text-ink">
        Store: <span className="font-medium">{storeName}</span>
      </p>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Rating</span>
        <input
          name="rating"
          type="number"
          inputMode="decimal"
          min={STORE_RATING_MIN}
          max={STORE_RATING_MAX}
          step={0.1}
          required
          defaultValue={formatStoreRating(rating)}
          className="h-11 w-full rounded-xl border border-line px-3"
        />
        <span className="block text-xs text-muted">
          {STORE_RATING_MIN} to {STORE_RATING_MAX.toFixed(1)}. Negative values are rejected.
        </span>
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Credit Score</span>
        <input
          name="creditScore"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          required
          defaultValue={Math.round(creditScore)}
          className="h-11 w-full rounded-xl border border-line px-3"
        />
        <span className="block text-xs text-muted">Whole number from 0 to 100.</span>
      </label>
      <Button type="submit">Save Changes</Button>
    </form>
  );
}
