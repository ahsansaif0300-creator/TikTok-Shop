import Link from "next/link";
import { loginAdminAction } from "@/lib/actions/auth";
import { RoleLoginForm } from "@/components/role-login-form";

export default async function SuperAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <RoleLoginForm
      title="Super Admin Login"
      subtitle="Main Backend for Harbor staff who manage every store, payouts, and system settings."
      action={loginAdminAction}
      error={error}
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
