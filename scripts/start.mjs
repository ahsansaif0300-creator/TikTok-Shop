import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

run(process.execPath, [path.join(root, "scripts", "bootstrap.mjs")]);

const port = process.env.PORT || "3000";
const nextBin = require.resolve("next/dist/bin/next");
run(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", String(port)]);
