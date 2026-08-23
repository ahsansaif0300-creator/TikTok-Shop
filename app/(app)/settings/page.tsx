import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { saveSettings } from "@/lib/actions/catalog";
import { Button, Card, Field, PageHeader } from "@/components/ui";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "SUPER_ADMIN") redirect("/");
  const { saved } = await searchParams;
  const rows = await prisma.setting.findMany();
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" subtitle="Workspace identity. Currency is display-only in this demo." />
      {saved ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Settings saved.</p>
      ) : null}
      <Card className="p-6">
        <form action={saveSettings} className="space-y-4">
          <Field name="storeName" label="Workspace name" defaultValue={settings.storeName ?? "Harbor Commerce"} />
          <Field name="supportEmail" label="Support email" defaultValue={settings.supportEmail ?? ""} />
          <Field name="supportUrl" label="Help center URL" defaultValue={settings.supportUrl ?? ""} />
          <Field name="currency" label="Currency" defaultValue={settings.currency ?? "USD"} />
          <Button type="submit">Save settings</Button>
        </form>
      </Card>
    </div>
  );
}
