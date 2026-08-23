import Link from "next/link";
import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";
import { LEDGER_TYPE, MERCHANT_STATUS, ORDER_STATUS } from "@/lib/labels";
import { assignPlan, setMerchantStatus } from "@/lib/actions/merchants";
import { Button, Card, Empty, PageHeader, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

export default async function MerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!isStaff(session.role)) redirect("/");
  const { id } = await params;
  const merchant = await prisma.merchant.findUnique({
    where: { id },
    include: {
      plan: true,
      users: true,
      products: { take: 8, orderBy: { updatedAt: "desc" } },
      orders: { take: 8, orderBy: { createdAt: "desc" }, include: { customer: true } },
      ledger: { take: 8, orderBy: { createdAt: "desc" } },
      _count: { select: { products: true, orders: true } },
    },
  });
  if (!merchant) notFound();
  const plans = await prisma.plan.findMany({ orderBy: { monthlyFee: "asc" } });
  const overCap = merchant._count.products > merchant.plan.maxProducts;

  return (
    <div>
      <PageHeader
        title={merchant.name}
        subtitle={`${merchant.legalName} · ${merchant.email}`}
        actions={<StatusBadge value={merchant.status} labels={MERCHANT_STATUS} />}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {merchant.status !== "ACTIVE" ? (
          <form action={setMerchantStatus.bind(null, merchant.id, "ACTIVE")}>
            <Button type="submit">Activate</Button>
          </form>
        ) : null}
        {merchant.status !== "SUSPENDED" ? (
          <form action={setMerchantStatus.bind(null, merchant.id, "SUSPENDED")}>
            <Button type="submit" variant="danger">
              Suspend
            </Button>
          </form>
        ) : null}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 text-sm xl:col-span-1">
          <h2 className="font-medium">Account</h2>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">City</dt>
              <dd>{merchant.city || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Phone</dt>
              <dd>{merchant.phone || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Catalog</dt>
              <dd className={overCap ? "font-semibold text-amber-800" : ""}>
                {merchant._count.products} / {merchant.plan.maxProducts}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Available</dt>
              <dd>{money(merchant.availableBalance)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Pending</dt>
              <dd>{money(merchant.pendingBalance)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Bank</dt>
              <dd>
                {merchant.bankName ? `${merchant.bankName} •${merchant.bankAccountLast4}` : "Not on file"}
              </dd>
            </div>
          </dl>
          <form action={assignPlan} className="mt-5 space-y-2">
            <input type="hidden" name="merchantId" value={merchant.id} />
            <label className="block text-sm">
              Seller plan
              <select
                name="planId"
                defaultValue={merchant.planId}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {(plan.commissionRate * 100).toFixed(0)}% fee · {plan.maxProducts} SKUs
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              Update plan
            </Button>
          </form>
          {merchant.users.length > 0 ? (
            <div className="mt-5">
              <h3 className="font-medium">Store users</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {merchant.users.map((user) => (
                  <li key={user.id}>
                    {user.name}
                    <span className="text-muted"> · {user.email}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted">No login is linked to this store yet.</p>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <div className="px-5 py-4 font-medium">Recent orders</div>
          {merchant.orders.length === 0 ? (
            <Empty title="No orders" body="Orders for this store will appear here." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody>
                {merchant.orders.map((order) => (
                  <tr key={order.id}>
                    <Td>
                      <Link href={`/orders/${order.id}`} className="text-accent hover:underline">
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td>{order.customer.name}</Td>
                    <Td>
                      <StatusBadge value={order.status} labels={ORDER_STATUS} />
                    </Td>
                    <Td>{money(order.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="px-5 py-4 font-medium">Catalog snapshot</div>
          {merchant.products.length === 0 ? (
            <Empty title="No products" body="This store has not listed SKUs yet." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                </tr>
              </thead>
              <tbody>
                {merchant.products.map((product) => (
                  <tr key={product.id}>
                    <Td>
                      <Link href={`/products/${product.id}`} className="hover:underline">
                        {product.title}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs">{product.sku}</Td>
                    <Td>{money(product.price)}</Td>
                    <Td>{product.stock}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
        <Card>
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-medium">Ledger</h2>
            <Link href="/finance" className="text-sm text-accent hover:underline">
              Full ledger
            </Link>
          </div>
          {merchant.ledger.length === 0 ? (
            <Empty title="No ledger rows" body="Settled sales and payouts will show here." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Type</Th>
                  <Th>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {merchant.ledger.map((entry) => (
                  <tr key={entry.id}>
                    <Td>{format(entry.createdAt, "MMM d")}</Td>
                    <Td>{LEDGER_TYPE[entry.type] ?? entry.type}</Td>
                    <Td>{money(entry.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
