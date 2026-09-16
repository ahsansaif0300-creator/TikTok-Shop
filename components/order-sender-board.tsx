"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { placeStaffOrder } from "@/lib/actions/admin";
import { money } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { ProductThumb } from "@/components/product-thumb";
import type { StoreSuggestion } from "@/lib/order-sender";

export type SenderProduct = {
  id: string;
  title: string;
  sku: string;
  category: string;
  stock: number;
  cost: number;
  price: number;
  image: string;
};

export type SenderStore = {
  id: string;
  name: string;
  storeCode: string;
  city: string;
  country: string;
};

export type SenderCustomer = {
  id: string;
  name: string;
  city: string;
};

function highlight(text: string, q: string) {
  const needle = q.trim();
  if (!needle) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-transparent font-semibold text-accent">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

function CircleCheck({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
        checked ? "border-accent bg-accent text-white" : "border-line bg-white text-transparent"
      }`}
      aria-hidden
    >
      <Check className="size-3.5 stroke-[3]" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function OrderSenderBoard({
  store,
  products,
  customers,
  timeValue,
}: {
  store: SenderStore | null;
  products: SenderProduct[];
  customers: SenderCustomer[];
  timeValue: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StoreSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState("");
  const [sending, setSending] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const allIds = useMemo(() => products.map((item) => item.id), [products]);
  const allSelected = products.length > 0 && allIds.every((id) => picked.has(id));

  useEffect(() => {
    function hide(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", hide);
    return () => document.removeEventListener("mousedown", hide);
  }, []);

  function requestSuggestions(value: string) {
    if (debounce.current) clearTimeout(debounce.current);
    const next = value.trim();
    if (!next) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/stores/search?q=${encodeURIComponent(next)}`, { cache: "no-store" }).catch(
        () => null,
      );
      if (!res?.ok) return;
      const json = (await res.json()) as { stores?: StoreSuggestion[] };
      setSuggestions(json.stores ?? []);
      setActive(0);
      setOpen(true);
    }, 160);
  }

  function chooseStore(item: StoreSuggestion) {
    setQuery(item.name);
    setOpen(false);
    setSuggestions([]);
    setPicked(new Set());
    router.push(`/admin/place-order?merchantId=${encodeURIComponent(item.id)}`);
  }

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setPicked(allSelected ? new Set() : new Set(allIds));
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (value + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (value - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = suggestions[active];
      if (item) chooseStore(item);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "selected" && picked.size === 0) {
      event.preventDefault();
      setLocalError("select");
      return;
    }
    setLocalError("");
    setSending(true);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <Card className="overflow-visible p-5">
          <h2 className="font-medium">Search Store</h2>
          <p className="mt-1 text-sm text-muted">Type a name, Store ID, city, or email. Suggestions appear as you type.</p>
          <div ref={box} className="relative mt-3">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                requestSuggestions(event.target.value);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setOpen(true);
              }}
              onKeyDown={onSearchKey}
              placeholder="Search Store"
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-controls="store-suggestions"
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none ring-accent/30 focus:ring-2"
            />
            {open ? (
              <ul
                id="store-suggestions"
                role="listbox"
                className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lg"
              >
                {suggestions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted">No matching stores.</li>
                ) : (
                  suggestions.map((item, index) => (
                    <li key={item.id} role="option" aria-selected={index === active}>
                      <button
                        type="button"
                        className={`block w-full px-3 py-2 text-left text-sm ${index === active ? "bg-accent-soft" : "hover:bg-soft"}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => chooseStore(item)}
                      >
                        <p className="font-medium text-ink">{highlight(item.name, query)}</p>
                        <p className="text-xs text-muted">
                          {item.storeCode ? `${item.storeCode} · ` : ""}
                          {item.city}, {item.country}
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>

          {store ? (
            <div className="mt-4 rounded-xl bg-soft px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-muted">Selected store</p>
              <p className="mt-1 font-medium text-ink">{store.name}</p>
              <p className="text-xs text-muted">
                {store.storeCode ? `${store.storeCode} · ` : ""}
                {store.city}, {store.country}
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-accent hover:underline"
                onClick={() => {
                  setQuery("");
                  setPicked(new Set());
                  router.push("/admin/place-order");
                }}
              >
                Change store
              </button>
            </div>
          ) : null}

          {store ? (
            customers.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No demo customers are in the database.</p>
            ) : (
              <form action={placeStaffOrder} onSubmit={onSubmit} className="mt-5 space-y-3">
                <input type="hidden" name="merchantId" value={store.id} />
                {[...picked].map((id) => (
                  <input key={id} type="hidden" name="productId" value={id} />
                ))}
                <h3 className="font-medium">Order details</h3>
                <p className="text-sm text-muted">These apply to Distribute and Distribute All.</p>
                {localError === "select" ? (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    Tick at least one product, or use Distribute All.
                  </p>
                ) : null}
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Quantity</span>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={99}
                    defaultValue={1}
                    required
                    className="h-11 w-full rounded-xl border border-line px-3"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Order time</span>
                  <input
                    name="orderTime"
                    type="datetime-local"
                    required
                    defaultValue={timeValue}
                    className="h-11 w-full rounded-xl border border-line px-3"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Customer (demo names)</span>
                  <select name="customerId" required className="h-11 w-full rounded-xl border border-line bg-white px-3">
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} · {customer.city}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="submit" name="intent" value="selected" disabled={sending || products.length === 0}>
                    {sending ? "Sending…" : `Distribute${picked.size ? ` (${picked.size})` : ""}`}
                  </Button>
                  <Button type="submit" name="intent" value="all" variant="secondary" disabled={sending || products.length === 0}>
                    Distribute All
                  </Button>
                </div>
              </form>
            )
          ) : null}
        </Card>
      </aside>

      <div className="space-y-4">
        {!store ? (
          <Card className="p-5">
            <p className="text-sm text-muted">
              Search and select a store. Its Listed products from Distribution Center will appear here.
            </p>
          </Card>
        ) : products.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-muted">
              {store.name} has no Listed products. Mark SKUs as Listed in Distribution Center — this screen reads the same
              product records.
            </p>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Listed products for <span className="font-medium text-ink">{store.name}</span>
                {picked.size > 0 ? ` · ${picked.size} selected` : ""}
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-soft"
              >
                <CircleCheck checked={allSelected} label={allSelected ? "Clear all" : "Select all"} />
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {products.map((product) => {
                const on = picked.has(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggle(product.id)}
                    className={`rounded-2xl border p-4 text-left ${on ? "border-accent bg-accent-soft" : "border-line bg-card hover:bg-soft"}`}
                  >
                    <div className="flex items-start gap-3">
                      <CircleCheck checked={on} label={on ? "Selected" : "Select"} />
                      <ProductThumb src={product.image} alt={product.title} size={64} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{product.title}</p>
                        <p className="text-xs text-muted">
                          {product.sku} · {product.category} · stock {product.stock}
                        </p>
                        <p className="mt-1 text-xs font-medium text-accent">{on ? "Selected" : "Select"}</p>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-white px-2 py-2">
                        <dt className="text-[11px] uppercase tracking-wide text-muted">Cost price</dt>
                        <dd className="mt-1 font-medium">{money(product.cost)}</dd>
                      </div>
                      <div className="rounded-lg bg-white px-2 py-2">
                        <dt className="text-[11px] uppercase tracking-wide text-muted">Total price</dt>
                        <dd className="mt-1 font-medium">{money(product.price)}</dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
