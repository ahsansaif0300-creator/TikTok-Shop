import Link from "next/link";
import { loginAdminAction } from "@/lib/actions/auth";
import { RoleLoginForm } from "@/components/role-login-form";
import { BRAND_NAME } from "@/lib/brand-name";
import { visibleLoginError } from "@/lib/access";

export default async function SuperAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <RoleLoginForm
      title="Super Admin Login"
      subtitle={`Main Backend for ${BRAND_NAME} staff who manage every store, payouts, and system settings.`}
      action={loginAdminAction}
      error={visibleLoginError(error)}
      footer={
        <>
          Store seller?{" "}
          <Link href="/login/store" className="font-medium text-cyan hover:underline">
            Store login
          </Link>
        </>
      }
    />
  );
}
