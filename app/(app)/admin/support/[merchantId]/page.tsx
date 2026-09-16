import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";

export default async function AdminSupportThreadPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  await requireSuperAdmin();
  const { merchantId } = await params;
  redirect(`/support-desk/${merchantId}`);
}
