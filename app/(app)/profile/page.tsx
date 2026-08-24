import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateProfileAction } from "@/lib/actions/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { shopAbsoluteUrl, shopPath } from "@/lib/shop-url";
import { Button, Card, Field, PageHeader } from "@/components/ui";
import { CopyShopLink } from "@/components/copy-shop-link";
import Link from "next/link";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireSession();
  const { saved, error } = await searchParams;
  const store =
    session.merchantId
      ? await prisma.merchant.findUnique({
          where: { id: session.merchantId },
          select: { name: true, slug: true },
        })
      : null;
  const shopUrl = store ? await shopAbsoluteUrl(store.slug) : null;

  return (
    <div className="max-w-xl">
      <PageHeader title="Profile" subtitle={`${ROLE_LABEL[session.role]} · ${session.email}`} />
      {saved ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Profile saved.</p>
      ) : null}
      {error === "password" ? (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          New password must be at least 8 characters.
        </p>
      ) : null}
      {shopUrl && store ? (
        <Card className="mb-4 p-5">
          <p className="text-sm font-medium text-ink">{store.name}</p>
          <p className="mt-1 text-xs text-muted">Share this unique shop link. Sign in from it to manage the store.</p>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-soft px-3 py-2">
            <Link href={shopPath(store.slug)} className="truncate font-mono text-xs text-accent hover:underline">
              {shopUrl}
            </Link>
            <CopyShopLink url={shopUrl} />
          </div>
        </Card>
      ) : null}
      <Card className="p-6">
        <form action={updateProfileAction} className="space-y-4">
          <Field name="name" label="Display name" defaultValue={session.name} required />
          <Field name="email" label="Email" defaultValue={session.email} disabled />
          <Field name="password" label="New password" type="password" />
          <p className="text-xs text-muted">Leave blank to keep your current password. Minimum 8 characters if you change it.</p>
          <Button type="submit">Save profile</Button>
        </form>
      </Card>
    </div>
  );
}
