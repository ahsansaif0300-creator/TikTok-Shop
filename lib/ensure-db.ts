import { installDemoDb } from "../scripts/copy-demo-db.mjs";
import { applyRuntimeEnv } from "./runtime-env";
import { getPrisma, resetPrisma } from "./db";

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
  const admin = await getPrisma().user.findFirst({
    where: { email: "oscar.d@example.net" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("Demo database installed but admin user is missing.");
  }
  await backfill();
}
