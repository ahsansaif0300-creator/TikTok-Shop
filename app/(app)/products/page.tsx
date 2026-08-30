import Link from "next/link";
import type { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { money } from "@/lib/utils";
import { PRODUCT_STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, SearchForm, StatusBadge, TableWrap, Tabs, Td, Th } from "@/components/ui";
import { ProductThumb } from "@/components/product-thumb";

const TABS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "LOW_STOCK", label: "Low stock" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await requireSession();
  const { status = "", q = "" } = await searchParams;
  const merchantView = session.role === "MERCHANT";
  const products = await prisma.product.findMany({
    where: {
      ...merchantScope(session),
      ...(status === "LOW_STOCK"
        ? { stock: { lte: 20 }, status: "ACTIVE" }
        : status
          ? { status: status as ProductStatus }
          : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { sku: { contains: q } }] } : {}),
    },
    include: { merchant: true, category: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Live catalog with real stock. Sales counts come from orders, not bulk-edited vanity metrics."
        actions={
          <Link href="/products/new" className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-white">
            Add product
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs items={TABS} active={status} basePath="/products" />
        <SearchForm placeholder="Search title or SKU" defaultValue={q} />
      </div>
      <Card>
        {products.length === 0 ? (
          <Empty title="No products" body="Add a product to start selling." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Product</Th>
                {merchantView ? null : <Th>Merchant</Th>}
                <Th>Category</Th>
                <Th>Price</Th>
                <Th>Stock</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-soft">
                  <Td>
                    <div className="flex items-center gap-3">
                      <ProductThumb src={product.image} alt={product.title} />
                      <div>
                        <Link href={`/products/${product.id}`} className="font-medium text-accent hover:underline">
                          {product.title}
                        </Link>
                        <p className="font-mono text-xs text-muted">{product.sku}</p>
                      </div>
                    </div>
                  </Td>
                  {merchantView ? null : <Td>{product.merchant.name}</Td>}
                  <Td>{product.category.name}</Td>
                  <Td>{money(product.price)}</Td>
                  <Td className={product.stock <= 20 ? "font-semibold text-amber-800" : ""}>{product.stock}</Td>
                  <Td>
                    <StatusBadge value={product.status} labels={PRODUCT_STATUS} />
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
