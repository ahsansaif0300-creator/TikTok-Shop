import Link from "next/link";
import { redirect } from "next/navigation";
import type { MerchantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";
import { MERCHANT_STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, SearchForm, StatusBadge, TableWrap, Tabs, Td, Th } from "@/components/ui";

const TABS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "SUSPENDED", label: "Suspended" },
];

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await requireSession();
  if (!isStaff(session.role)) redirect("/");
  const { status = "", q = "" } = await searchParams;
  const merchants = await prisma.merchant.findMany({
    where: {
      ...(status ? { status: status as MerchantStatus } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
    },
    include: { plan: true, _count: { select: { products: true, orders: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="Merchants" subtitle="Seller accounts with plans, catalog limits, and settlement balances from actual sales." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs items={TABS} active={status} basePath="/merchants" />
        <SearchForm placeholder="Search merchants" defaultValue={q} />
      </div>
      <Card>
        {merchants.length === 0 ? (
          <Empty title="No merchants" body="Approved applications become merchant accounts." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Merchant</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Catalog</Th>
                <Th>Available</Th>
                <Th>Pending</Th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant) => (
                <tr key={merchant.id} className="hover:bg-[#faf6ef]">
                  <Td>
                    <Link href={`/merchants/${merchant.id}`} className="font-medium text-accent hover:underline">
                      {merchant.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {merchant.city}, {merchant.country}
                    </p>
                  </Td>
                  <Td>{merchant.plan.name}</Td>
                  <Td>
                    <StatusBadge value={merchant.status} labels={MERCHANT_STATUS} />
                  </Td>
                  <Td>
                    {merchant._count.products} products
                    <p className="text-xs text-muted">{merchant._count.orders} orders</p>
                  </Td>
                  <Td>{money(merchant.availableBalance)}</Td>
                  <Td>{money(merchant.pendingBalance)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
