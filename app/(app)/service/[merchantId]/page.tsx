import { redirect } from "next/navigation";
import { isStaff, requireSession } from "@/lib/auth";

export default async function ServiceThreadPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  const session = await requireSession();
  const { merchantId } = await params;
  if (isStaff(session.role)) redirect(`/support-desk/${merchantId}`);
  redirect("/service");
}
