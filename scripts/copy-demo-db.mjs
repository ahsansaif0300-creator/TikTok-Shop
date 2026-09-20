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
const LIVE_SQLITE = "harbor-commerce.sqlite";

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

function isHealthy(file) {
  try {
    return existsSync(/*turbopackIgnore: true*/ file) && statSync(/*turbopackIgnore: true*/ file).size >= MIN_SEEDED_BYTES;
  } catch {
    return false;
  }
}

export function demoSqlitePath(root = process.cwd()) {
  return path.join(root, "prisma", "demo.sqlite");
}

export function persistentDataDirs(root = process.cwd()) {
  const dirs = [];
  const envDir = process.env.HARBOR_DATA_DIR?.trim();
  if (envDir) dirs.push(path.resolve(envDir));
  try {
    const home = os.homedir();
    if (home) dirs.push(path.join(home, ".harbor-commerce"));
  } catch {
    /* ignore */
  }
  dirs.push(path.join(root, "..", "harbor-data"));
  dirs.push(path.join(root, "data"));
  return dirs;
}

export function liveSqliteCandidates(root = process.cwd()) {
  return [
    ...persistentDataDirs(root).map((dir) => path.join(dir, LIVE_SQLITE)),
    path.join(root, "prisma", "dev.db"),
    path.join(root, LIVE_SQLITE),
    path.join(os.tmpdir(), LIVE_SQLITE),
  ];
}

export function opsUserSnapshotPaths(root = process.cwd()) {
  const paths = persistentDataDirs(root).map((dir) => path.join(dir, "ops-users.json"));
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("file:")) {
    const file = url.slice("file:".length);
    if (file) paths.push(path.join(path.dirname(file), "ops-users.json"));
  }
  return [...new Set(paths)];
}

export function installDemoDb(_root = process.cwd(), { overwrite = false } = {}) {
  const root = process.cwd();
  const demo = path.join(root, "prisma", "demo.sqlite");
  if (!existsSync(/*turbopackIgnore: true*/ demo)) {
    throw new Error(`Missing ${demo}. Redeploy the latest main branch.`);
  }

  const destinations = liveSqliteCandidates(root);
  const persistent = persistentDataDirs(root).map((dir) => path.join(dir, LIVE_SQLITE));

  if (!overwrite) {
    const existingPersistent = persistent.find(isHealthy);
    if (existingPersistent) return existingPersistent;

    const existingAny = destinations.find(isHealthy);
    if (existingAny) {
      for (const dest of persistent) {
        if (!canWrite(path.dirname(dest))) continue;
        try {
          copyFileSync(existingAny, dest);
          console.log(`[harbor] Preserved live database at ${dest}`);
          return dest;
        } catch (error) {
          console.warn("[harbor] Could not copy live database to persistent path", dest, error);
        }
      }
      return existingAny;
    }
  }

  let lastError = null;
  for (const dest of destinations) {
    const dir = path.dirname(dest);
    if (!canWrite(dir)) continue;
    try {
      const missing = !existsSync(/*turbopackIgnore: true*/ dest);
      const tiny = !missing && statSync(/*turbopackIgnore: true*/ dest).size < MIN_SEEDED_BYTES;
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

if (fileURLToPath(import.meta.url) === path.resolve(/*turbopackIgnore: true*/ process.argv[1] ?? "")) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dest = installDemoDb(root);
  console.log(dest);
}
