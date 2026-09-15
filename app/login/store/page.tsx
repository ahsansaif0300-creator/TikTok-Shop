import Link from "next/link";
import { loginStoreAction } from "@/lib/actions/auth";
import { RoleLoginForm } from "@/components/role-login-form";
import { BRAND_NAME } from "@/lib/brand-name";

export default async function StoreLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <RoleLoginForm
      title="Store Login"
      subtitle={`Sign in to your ${BRAND_NAME} dashboard. You only see this store’s catalog, orders, balance, and service inbox.`}
      action={loginStoreAction}
      error={error}
      footer={
        <>
          New seller?{" "}
          <Link href="/signup" className="font-medium text-cyan hover:underline">
            Create a shop
          </Link>
        </>
      }
    />
  );
}
