#!/usr/bin/env node
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const dir = mkdtempSync(path.join(os.tmpdir(), "harbor-user-persist-"));
const db = path.join(dir, "harbor-commerce.sqlite");
copyFileSync(path.join(root, "prisma", "demo.sqlite"), db);

process.env.HARBOR_USE_DEPLOY_DB = "1";
process.env.HARBOR_DATA_DIR = dir;
process.env.DATABASE_URL = `file:${db}`;

const { snapshotOpsUsers, restoreOpsUsers, readOpsSnapshots } = await import("../lib/ops-users-store.ts");
// tsx resolves @/ aliases from tsconfig.

const prisma = new PrismaClient({ datasources: { db: { url: `file:${db}` } } });

try {
  const email = "persist.rep@ops.harbor.local";
  const passwordHash = bcrypt.hashSync("PersistRep!2026", 8);
  await prisma.user.create({
    data: {
      name: "Persist Rep",
      email,
      username: "persistrep",
      passwordHash,
      role: "OPS",
      referralCode: "19990001",
    },
  });
  await snapshotOpsUsers(prisma);
  const afterCreate = readOpsSnapshots();
  if (!afterCreate.users.some((user) => user.email === email)) {
    throw new Error("created Normal Backend user was not snapshotted");
  }

  await prisma.user.delete({ where: { email } });
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error("wipe did not remove the user");
  }

  const restored = await restoreOpsUsers(prisma);
  if (restored < 1) throw new Error("restore did not bring the user back");
  const again = await prisma.user.findUnique({ where: { email } });
  if (!again || again.role !== "OPS") throw new Error("restored user missing");

  await prisma.user.delete({ where: { email } });
  await snapshotOpsUsers(prisma, { deletedEmail: email });
  const tombstoned = readOpsSnapshots();
  if (!tombstoned.deletedEmails.includes(email)) throw new Error("admin delete did not tombstone the user");
  const afterDelete = await restoreOpsUsers(prisma);
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error("deleted user came back after restore");
  }
  if (afterDelete !== 0 && tombstoned.users.some((user) => user.email === email)) {
    throw new Error("tombstoned user remained in the snapshot");
  }

  const packed = JSON.parse(readFileSync(path.join(root, "prisma", "recovered-ops-users.json"), "utf8"));
  if (!packed.users.some((user) => user.email === "keepuser1@ops.harbor.local")) {
    throw new Error("packed ops recovery missing keepuser1");
  }

  console.log(
    JSON.stringify({
      ok: true,
      restored,
      users: afterCreate.users.length,
      deleted: tombstoned.deletedEmails,
    }),
  );
} finally {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
}
