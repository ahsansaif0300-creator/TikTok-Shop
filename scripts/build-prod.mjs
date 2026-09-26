import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webpack =
  process.env.RENDER || process.env.HARBOR_WEBPACK_BUILD === "0" ? [] : ["--webpack"];

function run(bin, args) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(require.resolve("prisma/build/index.js"), ["generate"]);
run(require.resolve("next/dist/bin/next"), ["build", ...webpack]);
