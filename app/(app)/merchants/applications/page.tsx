import Link from "next/link";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { APPLICATION_STATUS } from "@/lib/labels";
import { createApplication, reviewApplication } from "@/lib/actions/merchants";
import { Button, Card, Empty, Field, PageHeader, StatusBadge, TableWrap, Tabs, Td, Th } from "@/components/ui";

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  if (!isStaff(session.role)) redirect("/");
  const { status = "" } = await searchParams;
  const applications = await prisma.merchantApplication.findMany({
    where: status ? { status: status as ApplicationStatus } : {},
    include: { reviewer: true, merchant: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div>
        <PageHeader
          title="Seller applications"
          subtitle="Inbound onboarding. Approval creates an active merchant on the Starter plan."
        />
        <div className="mb-4">
          <Tabs items={TABS} active={status} basePath="/merchants/applications" />
        </div>
        <Card>
          {applications.length === 0 ? (
            <Empty title="No applications" body="Log an inbound seller request or wait for a new submission." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Business</Th>
                  <Th>Contact</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Review</Th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <Td>
                      <p className="font-medium">{application.businessName}</p>
                      <p className="text-xs text-muted">
                        {application.country} · {format(application.createdAt, "MMM d")}
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-muted">{application.notes}</p>
                      {application.merchant ? (
                        <Link
                          href={`/merchants/${application.merchant.id}`}
                          className="mt-1 inline-block text-xs text-accent hover:underline"
                        >
                          Store: {application.merchant.name}
                        </Link>
                      ) : null}
                    </Td>
                    <Td>
                      {application.contactName}
                      <p className="text-xs text-muted">{application.email}</p>
                    </Td>
                    <Td>{application.category}</Td>
                    <Td>
                      <StatusBadge value={application.status} labels={APPLICATION_STATUS} />
                    </Td>
                    <Td>
                      {application.status === "PENDING" ? (
                        <form action={reviewApplication} className="space-y-2">
                          <input type="hidden" name="id" value={application.id} />
                          <input
                            name="reviewNote"
                            placeholder="Review note"
                            className="h-9 w-48 rounded-lg border border-line px-2 text-xs"
                          />
                          <div className="flex gap-2">
                            <Button name="decision" value="APPROVED" type="submit">
                              Approve
                            </Button>
                            <Button name="decision" value="REJECTED" type="submit" variant="danger">
                              Reject
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="text-xs text-muted">
                          <p>{application.reviewer?.name ?? "—"}</p>
                          {application.reviewNote ? <p className="mt-1">{application.reviewNote}</p> : null}
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
      <Card className="h-fit p-5">
        <h2 className="font-medium">Log inbound seller</h2>
        <p className="mt-1 text-sm text-muted">Staff-only intake. This is not a public marketplace signup.</p>
        <form action={createApplication} className="mt-4 space-y-3">
          <Field name="businessName" label="Business name" required />
          <Field name="contactName" label="Contact name" required />
          <Field name="email" label="Email" type="email" required />
          <Field name="phone" label="Phone" />
          <Field name="country" label="Country" required defaultValue="United States" />
          <Field name="category" label="Category" required />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Notes</span>
            <textarea name="notes" rows={3} className="w-full rounded-xl border border-line p-3 text-sm" />
          </label>
          <Button type="submit">Save application</Button>
        </form>
      </Card>
    </div>
  );
}
