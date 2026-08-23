import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { applyRuntimeEnv, sqliteFilePath } from "./runtime-env";

function runBootstrap(force = false) {
  applyRuntimeEnv();
  const script = path.join(process.cwd(), "scripts", "bootstrap.mjs");
  console.log("[harbor] Creating schema and demo accounts…");
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: { ...process.env, ...(force ? { HARBOR_FORCE_DB: "1" } : {}) },
    shell: false,
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    throw new Error("Database bootstrap failed. Check Hostinger Runtime logs.");
  }
}

export function pushAndSeed() {
  runBootstrap();
}

export async function ensureDatabase() {
  applyRuntimeEnv();
  const dbFile = sqliteFilePath();
  if (!existsSync(dbFile)) {
    runBootstrap();
  }

  const { prisma } = await import("./db");
  try {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) {
      await prisma.$disconnect();
      console.log("[harbor] Database has no users; seeding demo accounts…");
      runBootstrap(true);
    }
  } catch (error) {
    console.error("[harbor] Database is not ready; rebuilding SQLite.", error);
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    runBootstrap(true);
  }
}
