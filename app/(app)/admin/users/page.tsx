import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { createOpsUser } from "@/lib/actions/admin";
import { DeleteOpsUserButton } from "@/components/delete-ops-user-button";
import { Button, Card, PageHeader, TableWrap, Td, Th } from "@/components/ui";

const ERRORS: Record<string, string> = {
  username: "Username must be 3–32 characters: letters, numbers, dot, underscore, or hyphen.",
  password: "Password must be at least 8 characters.",
  taken: "That username is already in use.",
  missing: "That user is not in the Normal Backend list.",
};

export default async function BackendUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    username?: string;
    login?: string;
    referral?: string;
    error?: string;
    deleted?: string;
  }>;
}) {
  await requireSuperAdmin();
  const { created, username, login, referral, error, deleted } = await searchParams;
  const users = await prisma.user.findMany({
    where: { role: "OPS" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <PageHeader
          title="Normal backend users"
          subtitle="Operations logins for the main workspace. They stay here until you delete them. They cannot open Super admin tools."
        />
        {created && username && login ? (
          <div className="mb-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <p className="font-medium">User created. Send these credentials:</p>
            <p className="mt-2 font-mono text-xs break-all">Login URL: {login}</p>
            <p className="font-mono text-xs">Username: {username}</p>
            {referral ? <p className="font-mono text-xs break-all">LLC Code: {referral}</p> : null}
            <p className="text-xs text-emerald-800">Password is the value you just entered (it is not stored in this message).</p>
          </div>
        ) : null}
        {deleted ? (
          <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            User deleted. They can no longer sign in.
          </p>
        ) : null}
        {error && ERRORS[error] ? (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{ERRORS[error]}</p>
        ) : null}
        <Card>
          <TableWrap>
            <thead>
              <tr>
                <Th>Username</Th>
                <Th>LLC Code</Th>
                <Th>Email</Th>
                <Th>Created</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <Td className="font-medium">{user.username ?? "—"}</Td>
                  <Td className="font-mono text-xs">{user.referralCode ?? "—"}</Td>
                  <Td>{user.email}</Td>
                  <Td>{format(user.createdAt, "MMM d, yyyy")}</Td>
                  <Td>
                    <DeleteOpsUserButton userId={user.id} username={user.username || user.email} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      </div>
      <Card className="h-fit p-5">
        <h2 className="font-medium">Add normal backend user</h2>
        <p className="mt-1 text-xs text-muted">
          They sign in at /login/ops. Each user gets a numeric LLC Code for store signup. Created users stay until you
          delete them.
        </p>
        <form action={createOpsUser} className="mt-4 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Username</span>
            <input
              name="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9._-]+"
              className="h-11 w-full rounded-xl border border-line px-3 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="h-11 w-full rounded-xl border border-line px-3 text-sm"
            />
          </label>
          <Button type="submit">Create user</Button>
        </form>
      </Card>
    </div>
  );
}
