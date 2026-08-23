import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function sqlitePath() {
  const raw = (process.env.DATABASE_URL || "file:./dev.db").trim();
  if (!raw.startsWith("file:")) return path.join(root, "prisma", "dev.db");
  const rest = raw.slice("file:".length);
  if (path.isAbsolute(rest)) return rest;
  const normalized = rest.replace(/^\.\//, "");
  if (normalized === "dev.db") return path.join(root, "prisma", "dev.db");
  return path.resolve(root, normalized);
}

const dbFile = sqlitePath();
process.env.DATABASE_URL = `file:${dbFile}`;

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

if (!existsSync(dbFile)) {
  console.log("No database found. Creating schema and demo data…");
  const prismaBin = require.resolve("prisma/build/index.js");
  const tsxBin = require.resolve("tsx/dist/cli.mjs");
  run(prismaBin, ["db", "push", "--skip-generate", "--accept-data-loss"]);
  run(tsxBin, [path.join(root, "prisma", "seed.ts")]);
}
