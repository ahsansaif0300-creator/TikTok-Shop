import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { saveCategory } from "@/lib/actions/catalog";
import { Button, Card, Field, PageHeader, TableWrap, Td, Th } from "@/components/ui";

export default async function CategoriesPage() {
  const session = await requireSession();
  if (!isStaff(session.role)) redirect("/");
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <PageHeader title="Categories" subtitle="Shared catalog taxonomy for every merchant." />
        <Card>
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Slug</Th>
                <Th>Products</Th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <Td>No categories yet.</Td>
                  <Td>—</Td>
                  <Td>—</Td>
                </tr>
              ) : (
                categories.map((category) => (
                <tr key={category.id}>
                  <Td className="font-medium">{category.name}</Td>
                  <Td className="font-mono text-xs">{category.slug}</Td>
                  <Td>{category._count.products}</Td>
                </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Card>
      </div>
      <Card className="h-fit p-5">
        <h2 className="font-medium">Add category</h2>
        <form action={saveCategory} className="mt-4 space-y-3">
          <Field name="name" label="Name" required />
          <Button type="submit">Create</Button>
        </form>
      </Card>
    </div>
  );
}
