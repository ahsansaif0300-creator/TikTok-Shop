import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { MERCHANT_STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, SearchForm, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

export default async function StoreRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperAdmin();
  const { q = "" } = await searchParams;
  const stores = await prisma.merchant.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { city: { contains: q } },
            { country: { contains: q } },
            { slug: { contains: q } },
            { cnicNumber: { contains: q } },
            { legalName: { contains: q } },
          ],
        }
      : {},
    include: { plan: true, users: true, _count: { select: { products: true, orders: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="Store records" subtitle="Complete registered information for every store, including contact and identity fields." />
      <div className="mb-4">
        <SearchForm placeholder="Search name, email, phone, city, or ID number" defaultValue={q} />
      </div>
      <Card>
        {stores.length === 0 ? (
          <Empty title="No stores" body="Try another search." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Store</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>City</Th>
                <Th>Country</Th>
                <Th>ID number</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-soft">
                  <Td>
                    <Link href={`/admin/stores/${store.id}`} className="font-medium text-accent hover:underline">
                      {store.name}
                    </Link>
                    <p className="text-xs text-muted">{store.slug}</p>
                  </Td>
                  <Td>{store.email}</Td>
                  <Td>{store.phone || "—"}</Td>
                  <Td>{store.city || "—"}</Td>
                  <Td>{store.country || "—"}</Td>
                  <Td className="font-mono text-xs">{store.cnicNumber || "—"}</Td>
                  <Td>
                    <StatusBadge value={store.status} labels={MERCHANT_STATUS} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
