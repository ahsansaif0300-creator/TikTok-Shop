import Link from "next/link";
import { Landmark, LogOut, UserRound, Wallet, CirclePlus } from "lucide-react";
import { isStaff, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logoutAction, updateProfileAction } from "@/lib/actions/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { shopAbsoluteUrl, shopPath } from "@/lib/shop-url";
import { money } from "@/lib/utils";
import { Button, Card, Field, PageHeader } from "@/components/ui";
import { CopyShopLink } from "@/components/copy-shop-link";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireSession();
  const { saved, error } = await searchParams;
  const staff = isStaff(session.role);
  const store = session.merchantId
    ? await prisma.merchant.findUnique({
        where: { id: session.merchantId },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          availableBalance: true,
          pendingBalance: true,
        },
      })
    : null;
  const shopUrl = store ? await shopAbsoluteUrl(store.slug) : null;

  if (!staff && store) {
    return (
      <div className="max-w-xl">
        <PageHeader title="Profile" subtitle={`${store.name} · ${session.email}`} />
        <Card className="mb-4 p-5">
          <div className="flex items-center gap-4">
            {store.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logo} alt="" className="size-14 rounded-2xl object-cover ring-1 ring-line" />
            ) : (
              <div className="grid size-14 place-items-center rounded-2xl bg-soft text-xs font-semibold text-muted">
                Store
              </div>
            )}
            <div>
              <p className="text-xs text-muted">Available balance</p>
              <p className="text-2xl font-semibold text-ink">{money(store.availableBalance)}</p>
              <p className="text-xs text-muted">Pending {money(store.pendingBalance)}</p>
            </div>
          </div>
        </Card>
        {shopUrl ? (
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
        <div className="grid gap-3">
          <ProfileLink href="/recharge" icon={CirclePlus} label="Recharge / Add funds" />
          <ProfileLink href="/withdraw" icon={Landmark} label="Withdrawal" />
          <ProfileLink href="/account" icon={UserRound} label="Personal information" />
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left text-sm font-medium text-ink hover:bg-soft"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-700">
                <LogOut className="size-4" />
              </span>
              Logout
            </button>
          </form>
        </div>
      </div>
    );
  }

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

function ProfileLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Wallet;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm font-medium text-ink hover:bg-soft"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
        <Icon className="size-4" />
      </span>
      {label}
    </Link>
  );
}
