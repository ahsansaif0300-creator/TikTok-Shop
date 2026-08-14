import { format } from "date-fns";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canManageTeam, requireSession } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { createTeamUser } from "@/lib/actions/users";
import { Button, Card, Field, PageHeader, StatusBadge, TableWrap, Td, Th } from "@/components/ui";

export default async function UsersPage() {
  const session = await requireSession();
  if (!canManageTeam(session.role)) redirect("/");
  const users = await prisma.user.findMany({
    include: { merchant: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <PageHeader title="Team" subtitle="Staff accounts for the operations workspace. Merchants log in with a linked store." />
        <Card>
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Store</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <Td className="font-medium">{user.name}</Td>
                  <Td>{user.email}</Td>
                  <Td>
                    <StatusBadge value={user.role} labels={ROLE_LABEL} />
                  </Td>
                  <Td>{user.merchant?.name ?? "—"}</Td>
                  <Td>{format(user.createdAt, "MMM d, yyyy")}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      </div>
      <Card className="h-fit p-5">
        <h2 className="font-medium">Invite staff</h2>
        <form action={createTeamUser} className="mt-4 space-y-3">
          <Field name="name" label="Name" required />
          <Field name="email" label="Email" type="email" required />
          <Field name="password" label="Temporary password" type="password" required />
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Role</span>
            <select name="role" className="h-11 w-full rounded-xl border border-line bg-white px-3">
              <option value="OPS">Operations</option>
              <option value="SUPER_ADMIN">Super admin</option>
            </select>
          </label>
          <Button type="submit">Create user</Button>
        </form>
      </Card>
    </div>
  );
}
