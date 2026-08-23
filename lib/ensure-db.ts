import { installDemoDb } from "../scripts/copy-demo-db.mjs";
import { applyRuntimeEnv } from "./runtime-env";
import { getPrisma, resetPrisma } from "./db";

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
    if (user) return;
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
}
