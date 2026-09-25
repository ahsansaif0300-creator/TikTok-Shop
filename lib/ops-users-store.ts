import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { opsUserReadPaths, opsUserSnapshotPaths } from "../scripts/copy-demo-db.mjs";
import { allocateReferralCode } from "@/lib/referral";
import { queueRemotePush, REMOTE_OPS_PATH } from "@/lib/remote-persist";

type OpsSnapshotUser = {
  email: string;
  username: string | null;
  name: string;
  passwordHash: string;
  referralCode: string | null;
  createdAt: string;
};

type OpsSnapshot = {
  updatedAt: string;
  users: OpsSnapshotUser[];
  deletedEmails?: string[];
};

function parseSnapshot(raw: string): OpsSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as OpsSnapshot;
    if (!Array.isArray(parsed?.users)) return null;
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      users: parsed.users.filter((user) => user?.email && user?.passwordHash && user?.name),
      deletedEmails: (parsed.deletedEmails ?? [])
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean),
    };
  } catch {
    return null;
  }
}

function mergeSnapshots(parts: OpsSnapshot[]) {
  const users = new Map<string, OpsSnapshotUser>();
  const deleted = new Set<string>();
  for (const part of parts) {
    for (const email of part.deletedEmails ?? []) deleted.add(email);
    for (const user of part.users) {
      const email = user.email.trim().toLowerCase();
      if (!email) continue;
      users.set(email, { ...user, email });
    }
  }
  for (const email of deleted) users.delete(email);
  return {
    updatedAt: new Date().toISOString(),
    users: [...users.values()].sort((a, b) => a.email.localeCompare(b.email)),
    deletedEmails: [...deleted].sort(),
  } satisfies OpsSnapshot;
}

export function readOpsSnapshots() {
  const parts: OpsSnapshot[] = [];
  for (const file of opsUserReadPaths()) {
    try {
      if (!existsSync(file)) continue;
      const parsed = parseSnapshot(readFileSync(file, "utf8"));
      if (parsed) parts.push(parsed);
    } catch (error) {
      console.warn("[harbor] ops user snapshot read skipped", file, error);
    }
  }
  return mergeSnapshots(parts);
}

export async function snapshotOpsUsers(prisma: PrismaClient, extra?: { deletedEmail?: string }) {
  const previous = readOpsSnapshots();
  const users = await prisma.user.findMany({
    where: { role: "OPS" },
    select: {
      email: true,
      username: true,
      name: true,
      passwordHash: true,
      referralCode: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const liveEmails = new Set(users.map((user) => user.email.trim().toLowerCase()));
  const deleted = extra?.deletedEmail?.trim().toLowerCase();
  const deletedEmails = [
    ...new Set([
      ...previous.deletedEmails,
      ...(deleted ? [deleted] : []),
    ]),
  ]
    .filter((email) => email && !liveEmails.has(email))
    .sort();
  const payload: OpsSnapshot = {
    updatedAt: new Date().toISOString(),
    users: users.map((user) => ({
      email: user.email.trim().toLowerCase(),
      username: user.username,
      name: user.name,
      passwordHash: user.passwordHash,
      referralCode: user.referralCode,
      createdAt: user.createdAt.toISOString(),
    })),
    deletedEmails,
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  for (const file of opsUserSnapshotPaths()) {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, body);
    } catch (error) {
      console.warn("[harbor] ops user snapshot write skipped", file, error);
    }
  }
  queueRemotePush(REMOTE_OPS_PATH, body);
  return payload.users.length;
}

export async function restoreOpsUsers(prisma: PrismaClient) {
  const saved = readOpsSnapshots();
  if (saved.users.length === 0 && saved.deletedEmails.length === 0) return 0;
  let restored = 0;
  for (const row of saved.users) {
    const email = row.email.trim().toLowerCase();
    if (saved.deletedEmails.includes(email)) continue;
    const username = row.username?.trim().toLowerCase() || null;
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(username ? [{ username }] : [])],
      },
      select: { id: true },
    });
    if (existing) continue;

    let referralCode = row.referralCode?.trim() || null;
    if (referralCode) {
      const taken = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });
      if (taken) referralCode = await allocateReferralCode();
    } else {
      referralCode = await allocateReferralCode();
    }

    await prisma.user.create({
      data: {
        email,
        username,
        name: row.name,
        passwordHash: row.passwordHash,
        role: "OPS",
        referralCode,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
      },
    });
    restored += 1;
  }
  return restored;
}
