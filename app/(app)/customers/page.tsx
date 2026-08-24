import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";
import { Card, Empty, PageHeader, SearchForm, TableWrap, Td, Th } from "@/components/ui";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  if (!isStaff(session.role)) redirect("/");
  const { q = "" } = await searchParams;
  const customers = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { city: { contains: q } }] }
      : {},
    include: { orders: { select: { total: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Customers" subtitle="Shoppers who placed orders on the marketplace." />
      <div className="mb-4">
        <SearchForm placeholder="Search customers" defaultValue={q} />
      </div>
      <Card>
        {customers.length === 0 ? (
          <Empty title="No customers" body="Customers appear when orders are placed." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Location</Th>
                <Th>Orders</Th>
                <Th>Spend</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-soft">
                  <Td>
                    <Link href={`/customers/${customer.id}`} className="font-medium text-accent hover:underline">
                      {customer.name}
                    </Link>
                    <p className="text-xs text-muted">{customer.email}</p>
                  </Td>
                  <Td>
                    {customer.city}, {customer.country}
                  </Td>
                  <Td>{customer.orders.length}</Td>
                  <Td>{money(customer.orders.reduce((sum, order) => sum + order.total, 0))}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
