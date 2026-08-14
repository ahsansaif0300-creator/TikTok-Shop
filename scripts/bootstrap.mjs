import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const dbFile = path.join(process.cwd(), "prisma", "dev.db");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env, shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(dbFile)) {
  console.log("No database found. Creating schema and demo data…");
  run("npx", ["prisma", "db", "push", "--skip-generate"]);
  run("npx", ["tsx", "prisma/seed.ts"]);
}
