import { prisma } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import {
  changeLoginPassword,
  changePaymentPassword,
  updatePersonalInformation,
  updateStoreLogo,
} from "@/lib/actions/account";
import { Button, Card, Field, PageHeader } from "@/components/ui";

const ERRORS: Record<string, string> = {
  invalid: "Name and email are required.",
  email: "That email is already in use.",
  "logo-missing": "Choose a logo file first.",
  "logo-type": "Logo must be a JPEG, PNG, or WebP image.",
  "logo-size": "Logo must be 1.5 MB or smaller.",
  logo: "The logo could not be saved.",
  paypass: "Set a payment password before picking up orders.",
  "pay-length": "New payment password must be at least 8 characters.",
  "pay-mismatch": "New payment password and confirmation do not match.",
  "pay-current": "Current payment password is incorrect.",
  "login-length": "New login password must be at least 8 characters.",
  "login-mismatch": "New login password and confirmation do not match.",
  "login-current": "Current login password is incorrect.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    logo?: string;
    pay?: string;
    login?: string;
  }>;
}) {
  const session = await requireMerchant();
  const query = await searchParams;
  const [user, store] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.merchant.findUnique({ where: { id: session.merchantId } }),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Personal information" subtitle={`${store?.name ?? "Store"} · details saved on this account.`} />
      {query.error && ERRORS[query.error] ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[query.error]}</p>
      ) : null}
      {query.saved ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Personal information saved.</p>
      ) : null}
      {query.logo ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Store logo updated.</p>
      ) : null}
      {query.pay ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Payment password updated.</p>
      ) : null}
      {query.login ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Login password updated. This device was signed in again.
        </p>
      ) : null}

      <Card className="p-5">
        <h2 className="font-medium">Store logo</h2>
        <div className="mt-3 flex items-center gap-4">
          {store?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo} alt={`${store.name} logo`} className="size-16 rounded-2xl object-cover ring-1 ring-line" />
          ) : (
            <div className="grid size-16 place-items-center rounded-2xl bg-soft text-sm font-semibold text-muted">
              Logo
            </div>
          )}
          <form action={updateStoreLogo} className="space-y-2">
            <input
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className="block text-sm"
            />
            <p className="text-xs text-muted">JPEG, PNG, or WebP. 1.5 MB maximum.</p>
            <Button type="submit" variant="secondary">
              Change logo
            </Button>
          </form>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-medium">Contact details</h2>
        <form action={updatePersonalInformation} className="mt-4 space-y-3">
          <Field name="name" label="Full name" defaultValue={user?.name ?? session.name} required />
          <Field name="phone" label="Phone number" defaultValue={store?.phone ?? ""} />
          <Field name="email" label="Email address" defaultValue={user?.email ?? session.email} required />
          <Button type="submit">Save personal information</Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-medium">Change payment password</h2>
        <p className="mt-1 text-sm text-muted">
          Required to pick up orders. {user?.paymentPasswordHash ? "Enter the current password to replace it." : "Set one now."}
        </p>
        <form action={changePaymentPassword} className="mt-4 space-y-3">
          <Field
            name="currentPassword"
            label="Current payment password"
            type="password"
            required={Boolean(user?.paymentPasswordHash)}
          />
          <Field name="newPassword" label="New payment password" type="password" required />
          <Field name="confirmPassword" label="Confirm new payment password" type="password" required />
          <Button type="submit">Save payment password</Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-medium">Change login password</h2>
        <form action={changeLoginPassword} className="mt-4 space-y-3">
          <Field name="currentPassword" label="Current login password" type="password" required />
          <Field name="newPassword" label="New login password" type="password" required />
          <Field name="confirmPassword" label="Confirm new login password" type="password" required />
          <Button type="submit">Save login password</Button>
        </form>
      </Card>
    </div>
  );
}
