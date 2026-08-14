import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";
import { MERCHANT_STATUS } from "@/lib/labels";
import { assignPlan, setMerchantStatus } from "@/lib/actions/merchants";
import { Button, Card, PageHeader, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

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
      products: { take: 8, orderBy: { updatedAt: "desc" } },
      orders: { take: 8, orderBy: { createdAt: "desc" }, include: { customer: true } },
      ledger: { take: 8, orderBy: { createdAt: "desc" } },
    },
  });
  if (!merchant) notFound();
  const plans = await prisma.plan.findMany({ orderBy: { monthlyFee: "asc" } });

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
            <div className="flex justify-between gap-3"><dt className="text-muted">City</dt><dd>{merchant.city}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Rating</dt><dd>{merchant.rating.toFixed(1)} ({merchant.reviewCount})</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Available</dt><dd>{money(merchant.availableBalance)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Pending</dt><dd>{money(merchant.pendingBalance)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Bank</dt><dd>{merchant.bankName} •{merchant.bankAccountLast4}</dd></div>
          </dl>
          <form action={assignPlan} className="mt-5 space-y-2">
            <input type="hidden" name="merchantId" value={merchant.id} />
            <label className="block text-sm">
              Seller plan
              <select name="planId" defaultValue={merchant.planId} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3">
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {(plan.commissionRate * 100).toFixed(0)}% fee
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              Update plan
            </Button>
          </form>
        </Card>
        <Card className="xl:col-span-2">
          <div className="px-5 py-4 font-medium">Recent orders</div>
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
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
                  <Td>{money(order.total)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      </div>
      <Card className="mt-6">
        <div className="px-5 py-4 font-medium">Catalog snapshot</div>
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
      </Card>
    </div>
  );
}
