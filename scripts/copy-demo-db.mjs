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

export function repoRoot(start = process.cwd()) {
  let moduleDir = "";
  try {
    moduleDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    moduleDir = "";
  }
  const walked = [];
  let dir = start || process.cwd();
  for (let i = 0; i < 8; i += 1) {
    walked.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const candidates = [
    process.env.HARBOR_APP_ROOT?.trim(),
    start,
    process.cwd(),
    ...walked,
    moduleDir ? path.resolve(moduleDir, "..") : "",
    moduleDir ? path.resolve(moduleDir, "../..") : "",
    moduleDir ? path.resolve(moduleDir, "../../..") : "",
  ].filter(Boolean);
  for (const next of candidates) {
    const prismaDir = path.join(next, "prisma");
    if (
      existsSync(/*turbopackIgnore: true*/ path.join(prismaDir, "demo.sqlite")) ||
      (existsSync(/*turbopackIgnore: true*/ path.join(next, "package.json")) &&
        existsSync(/*turbopackIgnore: true*/ prismaDir))
    ) {
      return next;
    }
  }
  return start || process.cwd();
}

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

function isNonEmpty(file) {
  try {
    return existsSync(/*turbopackIgnore: true*/ file) && statSync(/*turbopackIgnore: true*/ file).size > 0;
  } catch {
    return false;
  }
}

export function demoSqlitePath(root = repoRoot()) {
  return path.join(root, "prisma", "demo.sqlite");
}

export function findPackedDemoSqlite(root = repoRoot()) {
  const candidates = [
    path.join(root, "prisma", "demo.sqlite"),
    path.join(process.cwd(), "prisma", "demo.sqlite"),
    demoSqlitePath(root),
  ];
  try {
    candidates.push(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "prisma", "demo.sqlite"));
  } catch {
    /* ignore */
  }
  return candidates.find((file) => {
    try {
      return existsSync(/*turbopackIgnore: true*/ file) && statSync(/*turbopackIgnore: true*/ file).size > 0;
    } catch {
      return false;
    }
  }) ?? null;
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
  const sibling = path.join(root, "..", "harbor-data");
  if (canWrite(sibling)) dirs.push(sibling);
  dirs.push(path.join(root, "data"));
  return dirs.filter((dir, index, all) => all.indexOf(dir) === index);
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

export function storeRecordsSnapshotPaths(root = process.cwd()) {
  const paths = persistentDataDirs(root).map((dir) => path.join(dir, "store-records.json"));
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("file:")) {
    const file = url.slice("file:".length);
    if (file) paths.push(path.join(path.dirname(file), "store-records.json"));
  }
  return [...new Set(paths)];
}

export function packedRecoveredStoresPath(root = repoRoot()) {
  return path.join(root, "prisma", "recovered-stores.json");
}

export function packedShopsPath(root = repoRoot()) {
  return path.join(root, "persist", "shops.json");
}

export function packedRecoveredOpsUsersPath(root = repoRoot()) {
  return path.join(root, "prisma", "recovered-ops-users.json");
}

/** Read packed recovery first, then live snapshots (later files win on the same slug). */
export function storeRecordsReadPaths(root = process.cwd()) {
  return [
    ...new Set([
      packedRecoveredStoresPath(root),
      packedShopsPath(root),
      ...storeRecordsSnapshotPaths(root),
    ]),
  ];
}

/** Packed recovery first, then live snapshots (later files win on the same email). */
export function opsUserReadPaths(root = process.cwd()) {
  return [...new Set([packedRecoveredOpsUsersPath(root), ...opsUserSnapshotPaths(root)])];
}

export function hostingerImportCandidates(root = repoRoot()) {
  return [
    process.env.HARBOR_IMPORT_DB?.trim(),
    path.join(root, "data", "hostinger-import.sqlite"),
    path.join(root, "prisma", "hostinger-import.sqlite"),
  ].filter(Boolean);
}

export function existingSqliteFiles(root = repoRoot()) {
  const files = [];
  for (const dest of liveSqliteCandidates(root)) {
    try {
      if (existsSync(/*turbopackIgnore: true*/ dest) && statSync(/*turbopackIgnore: true*/ dest).size > 0) {
        files.push(dest);
      }
    } catch {
      /* ignore */
    }
  }
  return files;
}

function importHostingerSqlite(root) {
  const source = hostingerImportCandidates(root).find(isNonEmpty);
  if (!source) return null;
  const persistent = persistentDataDirs(root).map((dir) => path.join(dir, LIVE_SQLITE));
  const live = persistent.find(isNonEmpty);
  const importSize = statSync(/*turbopackIgnore: true*/ source).size;
  const liveSize = live ? statSync(/*turbopackIgnore: true*/ live).size : 0;
  if (live && importSize <= liveSize && process.env.HARBOR_IMPORT_DB?.trim() !== source) {
    return live;
  }
  for (const dest of persistent) {
    if (!canWrite(path.dirname(dest))) continue;
    try {
      if (path.resolve(dest) !== path.resolve(source)) copyFileSync(source, dest);
      console.log(`[harbor] Restored Hostinger/import database at ${dest}`);
      return dest;
    } catch (error) {
      console.warn("[harbor] Could not import Hostinger database to", dest, error);
    }
  }
  return source;
}

/** Always prefer a persistent live file so deploys cannot wipe stores. */
export function resolveLiveSqlite(_root = process.cwd()) {
  const root = repoRoot(_root);
  const imported = importHostingerSqlite(root);
  if (imported) return imported;
  const persistent = persistentDataDirs(root).map((dir) => path.join(dir, LIVE_SQLITE));
  const existingPersistent = persistent.find(isNonEmpty);
  if (existingPersistent) return existingPersistent;

  const existingAny = liveSqliteCandidates(root).find(isNonEmpty);
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

  return installDemoDb(root, { overwrite: false });
}

export function installDemoDb(_root = process.cwd(), { overwrite = false } = {}) {
  const root = repoRoot(_root);
  const destinations = liveSqliteCandidates(root);
  const persistent = persistentDataDirs(root).map((dir) => path.join(dir, LIVE_SQLITE));
  const demo = findPackedDemoSqlite(root);
  const force = overwrite && process.env.HARBOR_FORCE_DB === "1";

  if (!force) {
    const existingPersistent = persistent.find(isNonEmpty);
    if (existingPersistent) return existingPersistent;

    const existingAny = destinations.find(isNonEmpty);
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

    const readable = existingSqliteFiles(root)[0];
    if (readable) {
      console.warn("[harbor] Packed demo SQLite missing or tiny; using existing", readable);
      return readable;
    }
  }

  if (!demo) {
    const readable = existingSqliteFiles(root)[0];
    if (readable) {
      console.warn("[harbor] prisma/demo.sqlite is missing; continuing with", readable);
      return readable;
    }
    throw new Error(`Missing packed demo database under ${root}. Redeploy the latest main branch.`);
  }

  let lastError = null;
  for (const dest of destinations) {
    const dir = path.dirname(dest);
    if (!canWrite(dir)) continue;
    try {
      const missing = !existsSync(/*turbopackIgnore: true*/ dest);
      const empty = !missing && statSync(/*turbopackIgnore: true*/ dest).size === 0;
      if (force || missing || empty) {
        copyFileSync(demo, dest);
        console.log(`[harbor] Installed demo database at ${dest}`);
      }
      return dest;
    } catch (error) {
      lastError = error;
    }
  }

  const fallback = existingSqliteFiles(root)[0];
  if (fallback) {
    console.warn("[harbor] Could not write a new SQLite file; using", fallback);
    return fallback;
  }

  throw lastError ?? new Error("No writable directory for SQLite on this host.");
}

/** Copy the live file to every writable persist folder so a remapped deploy path cannot drop stores. */
export function preserveLiveSqlite(source, root = process.cwd()) {
  if (!source || !isNonEmpty(source)) return;
  for (const dest of persistentDataDirs(root).map((dir) => path.join(dir, LIVE_SQLITE))) {
    if (path.resolve(dest) === path.resolve(source)) continue;
    if (!canWrite(path.dirname(dest))) continue;
    try {
      copyFileSync(source, dest);
    } catch (error) {
      console.warn("[harbor] Could not preserve live database at", dest, error);
    }
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(/*turbopackIgnore: true*/ process.argv[1] ?? "")) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dest = installDemoDb(root);
  console.log(dest);
}
