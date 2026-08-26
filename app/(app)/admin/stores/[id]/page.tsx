import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { money } from "@/lib/utils";
import { MERCHANT_STATUS } from "@/lib/labels";
import { shopAbsoluteUrl, shopPath } from "@/lib/shop-url";
import { updateStoreRecord } from "@/lib/actions/admin";
import { Button, Card, PageHeader, StatusBadge } from "@/components/ui";

export default async function StoreRecordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const { saved, error } = await searchParams;
  const store = await prisma.merchant.findUnique({
    where: { id },
    include: {
      plan: true,
      users: true,
      _count: { select: { products: true, orders: true } },
    },
  });
  if (!store) notFound();
  const shopUrl = await shopAbsoluteUrl(store.slug);

  return (
    <div>
      <PageHeader
        title={store.name}
        subtitle={store.legalName}
        actions={<StatusBadge value={store.status} labels={MERCHANT_STATUS} />}
      />
      {saved ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Store record saved.</p>
      ) : null}
      {error === "cnic" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">ID number should be 5–20 digits or hyphens.</p>
      ) : null}
      {error === "image" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Upload a JPG, PNG, or WebP under 1.5 MB.</p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5 text-sm">
          <h2 className="font-medium">Registered information</h2>
          <dl className="mt-4 space-y-2">
            {[
              ["Store name", store.name],
              ["Legal name", store.legalName],
              ["Slug", store.slug],
              ["Email", store.email],
              ["Phone", store.phone || "—"],
              ["City", store.city || "—"],
              ["Country", store.country || "—"],
              ["Address", store.address || "—"],
              ["Plan", store.plan.name],
              ["Available", money(store.availableBalance)],
              ["Pending", money(store.pendingBalance)],
              ["Bank", store.bankName ? `${store.bankName} •${store.bankAccountLast4}` : "Not on file"],
              ["Products", String(store._count.products)],
              ["Orders", String(store._count.orders)],
              ["Shop link", shopUrl],
              ["Registered", format(store.createdAt, "MMM d, yyyy HH:mm")],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted">{label}</dt>
                <dd className="max-w-[60%] break-all text-right">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted">
            Public card:{" "}
            <Link href={shopPath(store.slug)} className="text-accent hover:underline">
              {shopPath(store.slug)}
            </Link>
            {" · "}
            <Link href={`/merchants/${store.id}`} className="text-accent hover:underline">
              Operations page
            </Link>
          </p>
          <div className="mt-4">
            <h3 className="font-medium">Store logins</h3>
            {store.users.length === 0 ? (
              <p className="mt-1 text-muted">No seller login yet.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {store.users.map((user) => (
                  <li key={user.id}>
                    {user.name} · {user.email}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-medium">Identity document</h2>
          <p className="mt-1 text-sm text-muted">National ID number and picture on file for this store.</p>
          {store.cnicImage ? (
            <Image
              src={store.cnicImage}
              alt="Store identity document"
              width={640}
              height={360}
              unoptimized
              className="mt-4 max-h-64 w-auto rounded-xl border border-line object-contain"
            />
          ) : (
            <p className="mt-4 text-sm text-muted">No picture on file.</p>
          )}
          <form action={updateStoreRecord} className="mt-4 space-y-3">
            <input type="hidden" name="merchantId" value={store.id} />
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">ID number</span>
              <input
                name="cnicNumber"
                defaultValue={store.cnicNumber}
                placeholder="35202-1234567-1"
                className="h-11 w-full rounded-xl border border-line px-3"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">ID picture</span>
              <input name="cnicImage" type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" />
            </label>
            <Button type="submit">Save identity fields</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
