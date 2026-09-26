import type { Role } from "@prisma/client";
import { applyRuntimeEnv } from "@/lib/runtime-env";
import { getPrisma, resetPrisma } from "@/lib/db";
import { existingSqliteFiles, resolveLiveSqlite, repoRoot } from "../scripts/copy-demo-db.mjs";

export type LoginUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  passwordHash: string;
  role: Role;
  merchantId: string | null;
};

function openSqlite(dest: string) {
  process.env.DATABASE_URL = `file:${dest}`;
  resetPrisma();
}

async function queryUsers(sql: string, ...params: string[]) {
  return getPrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
}

async function peekUserTable() {
  try {
    const rows = await queryUsers(`SELECT id FROM "User" LIMIT 1`);
    return Boolean(rows?.[0]?.id);
  } catch {
    return false;
  }
}

export async function openLoginDatabase() {
  applyRuntimeEnv(repoRoot());
  if (await peekUserTable()) return true;

  const root = repoRoot();
  const queue: string[] = [];
  try {
    queue.push(resolveLiveSqlite(root));
  } catch (error) {
    console.warn("[harbor] login resolveLiveSqlite skipped", error);
  }
  try {
    queue.push(...existingSqliteFiles(root));
  } catch (error) {
    console.warn("[harbor] login sqlite scan skipped", error);
  }

  const tried = new Set<string>();
  for (const dest of queue) {
    if (!dest || tried.has(dest)) continue;
    tried.add(dest);
    try {
      openSqlite(dest);
      if (await peekUserTable()) return true;
    } catch (error) {
      console.warn("[harbor] login sqlite candidate failed", dest, error);
    }
  }

  try {
    const restored = resolveLiveSqlite(root);
    openSqlite(restored);
    if (await peekUserTable()) return true;
  } catch (error) {
    console.warn("[harbor] login packed restore skipped", error);
  }

  return peekUserTable();
}

function mapRow(row: Record<string, unknown> | undefined): LoginUser | null {
  if (!row?.id || !row.email || !row.passwordHash || !row.role) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    username: row.username ? String(row.username) : null,
    name: String(row.name ?? row.email),
    passwordHash: String(row.passwordHash),
    role: row.role as Role,
    merchantId: row.merchantId ? String(row.merchantId) : null,
  };
}

async function restorePersistedLogins() {
  try {
    const { pullRemotePersist } = await import("@/lib/remote-persist");
    const { restoreOpsUsers } = await import("@/lib/ops-users-store");
    const { restoreStores } = await import("@/lib/stores-persist");
    await pullRemotePersist();
    const prisma = getPrisma();
    await restoreOpsUsers(prisma);
    await restoreStores(prisma);
  } catch (error) {
    console.warn("[harbor] login persist restore skipped", error);
  }
}

export async function findLoginUser(identifier: string): Promise<LoginUser | null> {
  if (!identifier) return null;
  await openLoginDatabase();

  const queries = [
    `SELECT id, email, username, name, passwordHash, role, merchantId FROM "User" WHERE lower(email) = ? OR lower(coalesce(username, '')) = ? LIMIT 1`,
    `SELECT id, email, name, passwordHash, role, merchantId FROM "User" WHERE lower(email) = ? OR lower(coalesce(username, '')) = ? LIMIT 1`,
    `SELECT id, email, name, passwordHash, role, merchantId FROM "User" WHERE lower(email) = ? LIMIT 1`,
  ];

  for (const sql of queries) {
    try {
      const params = sql.includes("coalesce") ? [identifier, identifier] : [identifier];
      const rows = await queryUsers(sql, ...params);
      const user = mapRow(rows?.[0]);
      if (user) return user;
    } catch (error) {
      console.warn("[harbor] login sql lookup skipped", error);
    }
  }

  try {
    const user = await getPrisma().user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        passwordHash: true,
        role: true,
        merchantId: true,
      },
    });
    if (user) return user;
  } catch (error) {
    console.warn("[harbor] login prisma lookup skipped", error);
  }

  try {
    const user = await getPrisma().user.findFirst({
      where: { email: identifier },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
        merchantId: true,
      },
    });
    if (user) return { ...user, username: null };
  } catch (error) {
    console.warn("[harbor] login email lookup failed", error);
  }

  await restorePersistedLogins();
  try {
    const user = await getPrisma().user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        passwordHash: true,
        role: true,
        merchantId: true,
      },
    });
    return user;
  } catch (error) {
    console.warn("[harbor] login persist retry failed", error);
    return null;
  }
}

