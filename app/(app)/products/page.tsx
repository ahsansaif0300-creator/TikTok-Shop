import Link from "next/link";
import type { ProductListingStatus, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { money } from "@/lib/utils";
import { LISTING_STATUS, PRODUCT_STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, SearchForm, StatusBadge, TableWrap, Tabs, Td, Th } from "@/components/ui";
import { ProductThumb } from "@/components/product-thumb";
import { ensureMerchantCatalog } from "@/lib/sync-distribution-catalog";

const TABS = [
  { value: "", label: "All" },
  { value: "LISTED", label: "Listed" },
  { value: "ON_SHELF", label: "On Shelf" },
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
  if (session.role === "MERCHANT" && session.merchantId) {
    try {
      await ensureMerchantCatalog(prisma, session.merchantId);
    } catch (error) {
      console.error("[harbor] products catalog clone skipped", error);
    }
  }
  const { status = "", q = "" } = await searchParams;
  const merchantView = session.role === "MERCHANT";

  let products: Array<{
    id: string;
    title: string;
    sku: string;
    price: number;
    stock: number;
    listingStatus: ProductListingStatus;
    status: ProductStatus;
    image: string;
    merchant: { name: string } | null;
    category: { name: string } | null;
  }> = [];
  try {
    products = await prisma.product.findMany({
      where: {
        ...merchantScope(session),
        ...(status === "LOW_STOCK"
          ? { stock: { lte: 20 }, status: "ACTIVE", listingStatus: "LISTED" }
          : status === "LISTED" || status === "ON_SHELF"
            ? { listingStatus: status as ProductListingStatus }
            : status
              ? { status: status as ProductStatus }
              : {}),
        ...(q ? { OR: [{ title: { contains: q } }, { sku: { contains: q } }] } : {}),
      },
      select: {
        id: true,
        title: true,
        sku: true,
        price: true,
        stock: true,
        listingStatus: true,
        status: true,
        image: true,
        merchant: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    console.error("[harbor] products query failed", error);
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Live catalog with real stock. Listed SKUs show in the shop and Order Sender. On Shelf uses the same product record."
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
          <Empty
            title="No products"
            body={
              merchantView
                ? "Products appear here after the store is approved. Reload if the catalog is still copying."
                : "Add a product to start selling."
            }
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Product</Th>
                {merchantView ? null : <Th>Merchant</Th>}
                <Th>Category</Th>
                <Th>Price</Th>
                <Th>Stock</Th>
                <Th>Listing</Th>
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
                  {merchantView ? null : <Td>{product.merchant?.name ?? "—"}</Td>}
                  <Td>{product.category?.name ?? "—"}</Td>
                  <Td>{money(product.price)}</Td>
                  <Td className={product.stock <= 20 ? "font-semibold text-amber-800" : ""}>{product.stock}</Td>
                  <Td>
                    <StatusBadge value={product.listingStatus} labels={LISTING_STATUS} />
                  </Td>
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
