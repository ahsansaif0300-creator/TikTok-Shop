"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { PickupDialog } from "@/components/pickup-dialog";
import { ProductThumb } from "@/components/product-thumb";
import { Card, Empty, StatusBadge, TableWrap, Td, Th } from "@/components/ui";
import { ORDER_STATUS } from "@/lib/labels";
import { orderListStamp, type LiveOrder } from "@/lib/orders-live";
import { money } from "@/lib/utils";

export function OrdersLiveBoard({
  initialOrders,
  merchant,
  status,
  q,
}: {
  initialOrders: LiveOrder[];
  merchant: boolean;
  status: string;
  q: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const stamp = useRef(orderListStamp(initialOrders));

  useEffect(() => {
    setOrders(initialOrders);
    stamp.current = orderListStamp(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    let stop = false;
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const href = `/ol1${params.size ? `?${params.toString()}` : ""}`;

    async function pull() {
      try {
        const res = await fetch(href, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok || stop) return;
        const ctype = res.headers.get("content-type") || "";
        if (!ctype.includes("application/json")) return;
        const json = (await res.json()) as { orders?: LiveOrder[] };
        if (stop || !Array.isArray(json.orders)) return;
        const next = orderListStamp(json.orders);
        if (next === stamp.current) return;
        stamp.current = next;
        setOrders(json.orders);
      } catch {
        return;
      }
    }

    void pull();
    const id = setInterval(() => {
      if (document.hidden) return;
      void pull();
    }, 800);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [status, q]);

  const pickupOrders = merchant ? orders.filter((order) => order.status === "PENDING_PAYMENT") : [];

  return (
    <>
      {pickupOrders.length > 0 ? (
        <div className="mb-6 space-y-4">
          {pickupOrders.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">New order</p>
                  <Link href={`/orders/${order.id}`} className="text-lg font-semibold text-accent hover:underline">
                    {order.orderNumber}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {order.customer.name} · {format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
                <StatusBadge value={order.status} labels={ORDER_STATUS} />
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-soft px-3 py-2">
                    <span className="flex min-w-0 items-center gap-3">
                      <ProductThumb src={item.image} alt={item.title} size={48} />
                      <span>
                        {item.title}
                        <span className="block text-xs text-muted">Qty {item.quantity}</span>
                      </span>
                    </span>
                    <span className="font-medium">{money(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  Order amount <span className="font-semibold">{money(order.total)}</span>
                </p>
                <PickupDialog orderId={order.id} orderNumber={order.orderNumber} amountLabel={money(order.total)} />
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      <Card>
        {orders.length === 0 ? (
          <Empty title="No orders" body="Try another status or search term." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Product</Th>
                <Th>Merchant</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th>Status</Th>
                <Th>Total</Th>
                <Th>Profit</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-soft">
                  <Td>
                    <Link href={`/orders/${order.id}`} className="font-medium text-accent hover:underline">
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted">{format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}</p>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProductThumb src={order.items[0]?.image} alt={order.items[0]?.title ?? order.orderNumber} />
                      <span className="max-w-[160px] truncate text-sm">
                        {order.items[0]?.title ?? "—"}
                        {order.items.length > 1 ? ` +${order.items.length - 1}` : ""}
                      </span>
                    </div>
                  </Td>
                  <Td>{order.merchant.name}</Td>
                  <Td>
                    {order.customer.name}
                    <p className="text-xs text-muted">{order.customer.city}</p>
                  </Td>
                  <Td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</Td>
                  <Td>
                    <StatusBadge value={order.status} labels={ORDER_STATUS} />
                  </Td>
                  <Td>{money(order.total)}</Td>
                  <Td>{money(order.profit)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
