import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { opsUserSnapshotPaths } from "../scripts/copy-demo-db.mjs";
import { allocateReferralCode } from "@/lib/referral";

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
};

function parseSnapshot(raw: string): OpsSnapshotUser[] {
  try {
    const parsed = JSON.parse(raw) as OpsSnapshot;
    if (!Array.isArray(parsed?.users)) return [];
    return parsed.users.filter((user) => user?.email && user?.passwordHash && user?.name);
  } catch {
    return [];
  }
}

function readSnapshots() {
  const byEmail = new Map<string, OpsSnapshotUser>();
  for (const file of opsUserSnapshotPaths()) {
    try {
      if (!existsSync(file)) continue;
      for (const user of parseSnapshot(readFileSync(file, "utf8"))) {
        const email = user.email.trim().toLowerCase();
        if (!email) continue;
        byEmail.set(email, { ...user, email });
      }
    } catch (error) {
      console.warn("[harbor] ops user snapshot read skipped", file, error);
    }
  }
  return [...byEmail.values()];
}

export async function snapshotOpsUsers(prisma: PrismaClient) {
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
  const payload: OpsSnapshot = {
    updatedAt: new Date().toISOString(),
    users: users.map((user) => ({
      email: user.email,
      username: user.username,
      name: user.name,
      passwordHash: user.passwordHash,
      referralCode: user.referralCode,
      createdAt: user.createdAt.toISOString(),
    })),
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
}

export async function restoreOpsUsers(prisma: PrismaClient) {
  const saved = readSnapshots();
  if (saved.length === 0) return 0;
  let restored = 0;
  for (const row of saved) {
    const email = row.email.trim().toLowerCase();
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
