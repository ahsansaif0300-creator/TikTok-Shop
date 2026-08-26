import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoSqlitePath, installDemoDb } from "./copy-demo-db.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const force = process.env.HARBOR_FORCE_DB === "1";

function run(bin, args) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    stdio: "inherit",
    env: process.env,
    shell: false,
    cwd: root,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  const dest = installDemoDb(root, { overwrite: force });
  process.env.DATABASE_URL = `file:${dest}`;
  console.log(`SQLite ready at ${dest}`);
} catch (error) {
  if (existsSync(demoSqlitePath(root))) {
    console.error(error);
    process.exit(1);
  }
  console.log("No packed demo database. Creating schema and demo data with Prisma…");
  process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(root, "prisma", "dev.db")}`;
  const prismaBin = require.resolve("prisma/build/index.js");
  const tsxBin = require.resolve("tsx/dist/cli.mjs");
  run(prismaBin, ["db", "push", "--skip-generate", "--accept-data-loss"]);
  run(tsxBin, [path.join(root, "prisma", "seed.ts")]);
}

{
  const prismaBin = require.resolve("prisma/build/index.js");
  run(prismaBin, ["db", "push", "--skip-generate", "--accept-data-loss"]);
  console.log("SQLite schema is current.");
}
