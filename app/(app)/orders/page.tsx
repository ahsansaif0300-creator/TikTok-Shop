import { connection } from "next/server";
import { requireSession } from "@/lib/auth";
import { listLiveOrders } from "@/lib/orders-query";
import { OrdersLiveBoard } from "@/components/orders-live-board";
import { PageHeader, SearchForm, Tabs } from "@/components/ui";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING_PAYMENT", label: "Unpaid" },
  { value: "PAID", label: "Paid" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const ERRORS: Record<string, string> = {
  balance: "Insufficient Balance",
  paypass: "Payment password is incorrect.",
  picked: "That order was already picked up.",
  invalid: "That order is not available to pick up.",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; error?: string; picked?: string; id?: string }>;
}) {
  await connection();
  const session = await requireSession();
  const { status = "", q = "", error, picked } = await searchParams;
  const merchant = session.role === "MERCHANT";
  const orders = await listLiveOrders(session, { status, q });

  return (
    <div data-orders-live="tiktok-shop-orders-live">
      <PageHeader title="Orders" subtitle="Legitimate order lifecycle from payment through settlement." />
      {error && ERRORS[error] ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[error]}</p>
      ) : null}
      {picked ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Order picked up. It is now Paid.
        </p>
      ) : null}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs items={TABS} active={status} basePath="/orders" />
        <SearchForm placeholder="Search order, customer, merchant" defaultValue={q} />
      </div>
      <OrdersLiveBoard initialOrders={orders} merchant={merchant} status={status} q={q} />
    </div>
  );
}
