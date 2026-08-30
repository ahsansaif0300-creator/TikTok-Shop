import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccessMerchant } from "@/lib/scope";
import { saveProduct } from "@/lib/actions/catalog";
import { Button, Card, Field, PageHeader } from "@/components/ui";
import { ProductThumb } from "@/components/product-thumb";

const ERRORS: Record<string, string> = {
  cap: "This store is at its seller-plan product cap. Archive SKUs or move the store to a higher plan.",
  sku: "That SKU is already in use.",
  invalid: "Check title, SKU, category, and that price, cost, and stock are not negative.",
  forbidden: "You cannot save this product for that store.",
};

export default async function ProductFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { error } = await searchParams;
  const isNew = id === "new";
  const product = isNew ? null : await prisma.product.findUnique({
    where: { id },
    include: { reviews: { orderBy: { createdAt: "desc" } } },
  });
  if (!isNew && (!product || !canAccessMerchant(session, product.merchantId))) notFound();
  if (session.role === "MERCHANT" && !session.merchantId) redirect("/");

  const merchantId =
    session.role === "MERCHANT" ? session.merchantId : product?.merchantId ?? undefined;

  const [categories, merchants, merchant] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    session.role === "MERCHANT"
      ? prisma.merchant.findMany({ where: { id: session.merchantId ?? "" } })
      : prisma.merchant.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    merchantId
      ? prisma.merchant.findUnique({
          where: { id: merchantId },
          include: { plan: true, _count: { select: { products: true } } },
        })
      : Promise.resolve(null),
  ]);

  const remaining = merchant ? merchant.plan.maxProducts - merchant._count.products : null;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={isNew ? "New product" : product?.title ?? "Product"}
        subtitle="Cost is used for profit on orders. Stock is real inventory — not a vanity counter."
      />
      {error && ERRORS[error] ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[error]}</p>
      ) : null}
      {merchant && remaining !== null ? (
        <p className="mb-4 text-sm text-muted">
          {merchant.name} catalog: {merchant._count.products} / {merchant.plan.maxProducts} products
          {isNew ? ` · ${Math.max(0, remaining)} slots left on ${merchant.plan.name}` : ""}
        </p>
      ) : null}
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
                {merchants.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="merchantId" value={session.merchantId ?? ""} />
          )}
          <Field name="title" label="Title" defaultValue={product?.title} required />
          <Field name="sku" label="SKU" defaultValue={product?.sku} required />
          {product?.image ? (
            <div className="flex items-center gap-3">
              <ProductThumb src={product.image} alt={product.title} size={72} />
              <p className="text-sm text-muted">Current catalog photo. New products get a dummy photo automatically if you leave Image blank.</p>
            </div>
          ) : null}
          <Field name="image" label="Image path or URL" defaultValue={product?.image ?? ""} />
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
            <select
              name="status"
              defaultValue={product?.status ?? "ACTIVE"}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <Button type="submit" disabled={Boolean(isNew && remaining !== null && remaining <= 0)}>
            {isNew ? "Create product" : "Save changes"}
          </Button>
        </form>
      </Card>
      {product && product.reviews.length > 0 ? (
        <Card className="mt-6 p-6">
          <h2 className="font-medium">Reviews</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {product.reviews.map((review) => (
              <li key={review.id} className="rounded-xl bg-soft px-3 py-2">
                <p className="font-medium">
                  {review.author} · {"★".repeat(review.rating)}
                </p>
                <p className="text-muted">{review.comment}</p>
                <p className="text-xs text-muted">{format(review.createdAt, "MMM d, yyyy")}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
