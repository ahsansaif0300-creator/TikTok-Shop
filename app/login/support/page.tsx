import { loginSupportAction } from "@/lib/actions/auth";
import { RoleLoginForm } from "@/components/role-login-form";
import { visibleLoginError } from "@/lib/access";

export default async function SupportLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <RoleLoginForm
      title="Support Desk Login"
      subtitle="Private console for the support team. Store chats, store IDs, and the 1-hour timer are all on the next screen."
      action={loginSupportAction}
      error={visibleLoginError(error)}
    />
  );
}
