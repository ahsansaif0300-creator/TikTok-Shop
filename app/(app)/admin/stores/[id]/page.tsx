import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { money } from "@/lib/utils";
import { MERCHANT_STATUS } from "@/lib/labels";
import { shopAbsoluteUrl, shopPath } from "@/lib/shop-url";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { StoreIdentityForm } from "@/components/store-identity-form";
import { StoreScoreForm } from "@/components/store-score-form";
import { formatStoreRating } from "@/lib/store-score";

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
      referredBy: { select: { name: true, username: true, referralCode: true, email: true } },
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
      {saved === "score" ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Rating and credit score saved. The store dashboard will show the new values.
        </p>
      ) : saved ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Store record saved.</p>
      ) : null}
      {error === "cnic" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">ID number should be 5–20 digits or hyphens.</p>
      ) : null}
      {error === "city" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">City should be under 80 characters.</p>
      ) : null}
      {error === "phone" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Phone should be 5–20 digits or + ( ).</p>
      ) : null}
      {error === "llc" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">LLC code should be 4–20 letters or digits.</p>
      ) : null}
      {error === "image" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Upload a JPG, PNG, or WebP under 1.5 MB.</p>
      ) : null}
      {error === "score" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Rating must be 0–5.0 and credit score must be a whole number 0–100. Negative values are not allowed.
        </p>
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
              ["Store Rating", formatStoreRating(store.rating)],
              ["Credit Score", `${Math.round(store.creditScore)} / 100`],
              ["Available", money(store.availableBalance)],
              ["Pending", money(store.pendingBalance)],
              ["Bank", store.bankName ? `${store.bankName} •${store.bankAccountLast4}` : "Not on file"],
              ["Products", String(store._count.products)],
              ["Orders", String(store._count.orders)],
              ["Shop link", shopUrl],
              ["LLC Code", store.referralCodeUsed || "—"],
              [
                "Referred by",
                store.referredBy
                  ? `${store.referredBy.name} (${store.referredBy.username || store.referredBy.email})`
                  : "—",
              ],
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
          <p className="mt-1 text-sm text-muted">ID card front and back collected at store signup.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted">Front</p>
              {store.cnicImageFront || store.cnicImage ? (
                <Image
                  src={store.cnicImageFront || store.cnicImage}
                  alt="ID card front"
                  width={640}
                  height={360}
                  unoptimized
                  className="mt-2 max-h-56 w-auto rounded-xl border border-line object-contain"
                />
              ) : (
                <p className="mt-2 text-sm text-muted">No front picture on file.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Back</p>
              {store.cnicImageBack ? (
                <Image
                  src={store.cnicImageBack}
                  alt="ID card back"
                  width={640}
                  height={360}
                  unoptimized
                  className="mt-2 max-h-56 w-auto rounded-xl border border-line object-contain"
                />
              ) : (
                <p className="mt-2 text-sm text-muted">No back picture on file.</p>
              )}
            </div>
          </div>
          <StoreIdentityForm
            merchantId={store.id}
            cnicNumber={store.cnicNumber}
            city={store.city}
            phone={store.phone}
            llcCode={store.referralCodeUsed}
          />
        </Card>
        <Card className="p-5 xl:col-span-2">
          <h2 className="font-medium">Store Rating and Credit Score</h2>
          <p className="mt-1 text-sm text-muted">
            Only Super Admin can change these. Store logins cannot edit them.
          </p>
          <div className="mt-4 max-w-md">
            <StoreScoreForm
              merchantId={store.id}
              storeName={store.name}
              rating={store.rating}
              creditScore={store.creditScore}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
