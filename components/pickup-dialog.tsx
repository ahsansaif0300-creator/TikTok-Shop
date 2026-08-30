import { pickUpOrder } from "@/lib/actions/pickup";
import { Button } from "@/components/ui";

export function PickupDialog({
  orderId,
  orderNumber,
  amountLabel,
  cancelHref = "/orders",
}: {
  orderId: string;
  orderNumber: string;
  amountLabel: string;
  cancelHref?: string;
}) {
  return (
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#e11d48] [&::-webkit-details-marker]:hidden">
        Click to Pick Up
      </summary>
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
        <form action={pickUpOrder} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
          <input type="hidden" name="orderId" value={orderId} />
          <div>
            <h2 className="text-lg font-semibold text-ink">Confirm pickup</h2>
            <p className="mt-1 text-sm text-muted">
              Pick up {orderNumber} for {amountLabel}. Enter your payment password to continue. The password stays
              hidden.
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Payment password</span>
            <input
              name="paymentPassword"
              type="password"
              required
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
          </label>
          <div className="flex justify-end gap-2">
            <a
              href={cancelHref}
              className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink hover:bg-soft"
            >
              Cancel
            </a>
            <Button type="submit">Confirm pickup</Button>
          </div>
        </form>
      </div>
    </details>
  );
}
