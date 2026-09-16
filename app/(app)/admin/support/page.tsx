import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";

export default async function AdminSupportInboxPage() {
  await requireSuperAdmin();
  redirect("/support-desk");
}
