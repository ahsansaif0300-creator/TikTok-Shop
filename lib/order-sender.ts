import { prisma } from "@/lib/db";

export type StoreSuggestion = {
  id: string;
  name: string;
  storeCode: string;
  city: string;
  country: string;
  email: string;
};

export async function searchOrderSenderStores(q: string, limit = 8): Promise<StoreSuggestion[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];

  const rows = await prisma.merchant.findMany({
    where: { status: { not: "SUSPENDED" } },
    select: {
      id: true,
      name: true,
      storeCode: true,
      city: true,
      country: true,
      email: true,
      slug: true,
      legalName: true,
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return rows
    .filter((row) =>
      [row.name, row.storeCode, row.city, row.country, row.email, row.slug, row.legalName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle)),
    )
    .slice(0, limit)
    .map(({ id, name, storeCode, city, country, email }) => ({
      id,
      name,
      storeCode,
      city,
      country,
      email,
    }));
}
