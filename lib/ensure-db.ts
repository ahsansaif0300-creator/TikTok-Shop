import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { installDemoDb } from "../scripts/copy-demo-db.mjs";
import { applyRuntimeEnv } from "./runtime-env";
import { getPrisma, resetPrisma } from "./db";

const require = createRequire(import.meta.url);

function applySchema() {
  const prismaBin = require.resolve("prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaBin, "db", "push", "--skip-generate", "--accept-data-loss"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error("[harbor] prisma db push failed", result.stderr || result.stdout);
    throw new Error("Could not apply the workspace database schema.");
  }
}

async function backfill() {
  const prisma = getPrisma();
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET walletReleased = 1 WHERE status = 'COMPLETED' AND walletReleased = 0`,
    );
  } catch (error) {
    console.warn("[harbor] walletReleased backfill skipped", error);
  }
}

export async function ensureDatabase() {
  applyRuntimeEnv();
  const root = process.cwd();
  const dest = installDemoDb(root);
  process.env.DATABASE_URL = `file:${dest}`;
  resetPrisma();
  applySchema();
  resetPrisma();

  try {
    const user = await getPrisma().user.findFirst({
      where: { email: "oscar.d@example.net" },
      select: { id: true },
    });
    if (user) {
      await backfill();
      return;
    }
    console.warn("[harbor] Demo admin missing; restoring packed SQLite.");
  } catch (error) {
    console.error("[harbor] SQLite not readable; restoring packed database.", error);
  }

  const restored = installDemoDb(root, { overwrite: true });
  process.env.DATABASE_URL = `file:${restored}`;
  resetPrisma();
  applySchema();
  resetPrisma();
  const admin = await getPrisma().user.findFirst({
    where: { email: "oscar.d@example.net" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("Demo database installed but admin user is missing.");
  }
  await backfill();
}
