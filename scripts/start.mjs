import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printAccessUrls } from "./lan-urls.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: false,
    cwd: root,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolvePort() {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-p" || arg === "--port") {
      return argv[i + 1] || process.env.PORT || "3000";
    }
    if (arg.startsWith("--port=")) {
      return arg.slice("--port=".length) || process.env.PORT || "3000";
    }
  }
  return process.env.PORT || "3000";
}

function latestMtime(target) {
  const full = path.isAbsolute(target) ? target : path.join(root, target);
  if (!existsSync(full)) return 0;
  const st = statSync(full);
  if (st.isFile()) return st.mtimeMs;
  let max = st.mtimeMs;
  for (const name of readdirSync(full)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    max = Math.max(max, latestMtime(path.join(full, name)));
  }
  return max;
}

function sourceMtime() {
  return Math.max(
    latestMtime("app"),
    latestMtime("components"),
    latestMtime("lib"),
    latestMtime("prisma/schema.prisma"),
    latestMtime("public"),
    latestMtime("next.config.mjs"),
    latestMtime("package.json"),
  );
}

function builtAt() {
  const id = path.join(root, ".next", "BUILD_ID");
  if (!existsSync(id)) return 0;
  return statSync(id).mtimeMs;
}

function releaseLabel() {
  try {
    return readFileSync(path.join(root, "public", "release.txt"), "utf8").split("\n")[0].trim();
  } catch {
    return "";
  }
}

function builtRelease() {
  try {
    return readFileSync(path.join(root, ".next", "harbor-release.txt"), "utf8").trim();
  } catch {
    return "";
  }
}

function rebuildIfStale() {
  const force = process.env.HARBOR_REBUILD_ON_START === "1";
  const skip = process.env.HARBOR_REBUILD_ON_START === "0";
  if (skip) return;
  const source = sourceMtime();
  const built = builtAt();
  const stamp = releaseLabel();
  const builtStamp = builtRelease();
  const stampChanged = Boolean(stamp) && stamp !== builtStamp;
  if (!force && built && source <= built + 2000 && !stampChanged) return;
  console.log("[harbor] App source is newer than .next (or release stamp changed). Running next build…");
  const prismaBin = require.resolve("prisma/build/index.js");
  const nextBin = require.resolve("next/dist/bin/next");
  run(process.execPath, [prismaBin, "generate"]);
  run(process.execPath, [nextBin, "build"]);
  try {
    writeFileSync(path.join(root, ".next", "harbor-release.txt"), stamp || "unknown");
  } catch (error) {
    console.warn("[harbor] Could not write release stamp", error);
  }
}

run(process.execPath, [path.join(root, "scripts", "bootstrap.mjs")]);
rebuildIfStale();

const port = resolvePort();
printAccessUrls(port);
const nextBin = require.resolve("next/dist/bin/next");
run(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", String(port)]);
