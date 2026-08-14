import { format } from "date-fns";
import { redirect } from "next/navigation";
import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { APPLICATION_STATUS } from "@/lib/labels";
import { reviewApplication } from "@/lib/actions/merchants";
import { Button, Card, Empty, PageHeader, StatusBadge, TableWrap, Tabs, Td, Th } from "@/components/ui";

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
    include: { reviewer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Seller applications" subtitle="KYC-style onboarding. Approval creates an active merchant on the Starter plan." />
      <div className="mb-4">
        <Tabs items={TABS} active={status} basePath="/merchants/applications" />
      </div>
      <Card>
        {applications.length === 0 ? (
          <Empty title="No applications" body="Inbound seller requests show up here." />
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
                    <p className="text-xs text-muted">{application.country} · {format(application.createdAt, "MMM d")}</p>
                    <p className="mt-1 max-w-sm text-xs text-muted">{application.notes}</p>
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
                      <p className="text-xs text-muted">{application.reviewer?.name ?? "—"}</p>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
