import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MIN_SEEDED_BYTES = 50_000;

function canWrite(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.harbor-write-${process.pid}`);
    writeFileSync(probe, "ok");
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

export function demoSqlitePath(root = process.cwd()) {
  return path.join(root, "prisma", "demo.sqlite");
}

export function installDemoDb(_root = process.cwd(), { overwrite = false } = {}) {
  const demo = path.join(process.cwd(), "prisma", "demo.sqlite");
  if (!existsSync(/*turbopackIgnore: true*/ demo)) {
    throw new Error(`Missing ${demo}. Redeploy the latest main branch.`);
  }

  const candidates = [
    path.join(process.cwd(), "prisma", "dev.db"),
    path.join(process.cwd(), "harbor-commerce.sqlite"),
    path.join(os.tmpdir(), "harbor-commerce.sqlite"),
  ];

  let lastError = null;
  for (const dest of candidates) {
    const dir = path.dirname(dest);
    if (!canWrite(dir)) continue;
    try {
      const missing = !existsSync(dest);
      const tiny = !missing && statSync(dest).size < MIN_SEEDED_BYTES;
      if (overwrite || missing || tiny) {
        copyFileSync(demo, dest);
        console.log(`[harbor] Installed demo database at ${dest}`);
      }
      return dest;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No writable directory for SQLite on this host.");
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dest = installDemoDb(root);
  console.log(dest);
}
