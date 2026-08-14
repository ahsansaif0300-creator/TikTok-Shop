import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccessMerchant } from "@/lib/scope";
import { saveProduct } from "@/lib/actions/catalog";
import { Button, Card, Field, PageHeader } from "@/components/ui";

export default async function ProductFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const isNew = id === "new";
  const product = isNew
    ? null
    : await prisma.product.findUnique({ where: { id } });
  if (!isNew && (!product || !canAccessMerchant(session, product.merchantId))) notFound();
  if (session.role === "MERCHANT" && !session.merchantId) redirect("/");

  const [categories, merchants] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    session.role === "MERCHANT"
      ? prisma.merchant.findMany({ where: { id: session.merchantId ?? "" } })
      : prisma.merchant.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader title={isNew ? "New product" : product?.title ?? "Product"} subtitle="Cost is used for profit on orders. Stock decrements when you later wire checkout; this workspace is ops-first." />
      <Card className="p-6">
        <form action={saveProduct} className="grid gap-4">
          {product ? <input type="hidden" name="id" value={product.id} /> : null}
          {session.role !== "MERCHANT" ? (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Merchant</span>
              <select
                name="merchantId"
                defaultValue={product?.merchantId}
                className="h-11 w-full rounded-xl border border-line bg-white px-3"
                required
              >
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="merchantId" value={session.merchantId ?? ""} />
          )}
          <Field name="title" label="Title" defaultValue={product?.title} required />
          <Field name="sku" label="SKU" defaultValue={product?.sku} required />
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Category</span>
            <select
              name="categoryId"
              defaultValue={product?.categoryId}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Description</span>
            <textarea
              name="description"
              defaultValue={product?.description}
              rows={4}
              className="w-full rounded-xl border border-line p-3"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="price" label="Price" type="number" defaultValue={product?.price ?? 0} required />
            <Field name="cost" label="Cost" type="number" defaultValue={product?.cost ?? 0} required />
            <Field name="stock" label="Stock" type="number" defaultValue={product?.stock ?? 0} required />
          </div>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Status</span>
            <select name="status" defaultValue={product?.status ?? "ACTIVE"} className="h-11 w-full rounded-xl border border-line bg-white px-3">
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <Button type="submit">{isNew ? "Create product" : "Save changes"}</Button>
        </form>
      </Card>
    </div>
  );
}
