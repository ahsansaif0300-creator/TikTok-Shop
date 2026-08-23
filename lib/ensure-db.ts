import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { applyRuntimeEnv, sqliteFilePath } from "./runtime-env";

const require = createRequire(import.meta.url);

function run(bin: string, args: string[]) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    stdio: "inherit",
    env: process.env,
    shell: false,
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${path.basename(bin)} ${args.join(" ")}`);
  }
}

export function pushAndSeed() {
  applyRuntimeEnv();
  const prismaBin = require.resolve("prisma/build/index.js");
  const tsxBin = require.resolve("tsx/dist/cli.mjs");
  console.log("[harbor] Creating schema and demo accounts…");
  run(prismaBin, ["db", "push", "--skip-generate", "--accept-data-loss"]);
  run(tsxBin, [path.join(process.cwd(), "prisma", "seed.ts")]);
}

export async function ensureDatabase() {
  applyRuntimeEnv();
  const dbFile = sqliteFilePath();
  if (!existsSync(dbFile)) {
    pushAndSeed();
  }

  const { prisma } = await import("./db");
  try {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) {
      await prisma.$disconnect();
      console.log("[harbor] Database has no users; seeding demo accounts…");
      pushAndSeed();
    }
  } catch (error) {
    console.error("[harbor] Database is not ready; rebuilding SQLite.", error);
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    pushAndSeed();
  }
}
