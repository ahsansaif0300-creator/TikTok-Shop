import Link from "next/link";
import { loginOpsAction } from "@/lib/actions/auth";
import { RoleLoginForm } from "@/components/role-login-form";
import { visibleLoginError } from "@/lib/access";

export default async function OpsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <RoleLoginForm
      title="Normal Backend Login"
      subtitle="Operations workspace for onboarding, orders across stores, refunds, and payouts."
      action={loginOpsAction}
      error={visibleLoginError(error)}
      footer={
        <>
          Super admin?{" "}
          <Link href="/login/admin" className="font-medium text-cyan hover:underline">
            Main Backend login
          </Link>
        </>
      }
    />
  );
}
