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

const port = process.env.PORT || "3000";
printAccessUrls(port);

const nextBin = require.resolve("next/dist/bin/next");
run(process.execPath, [nextBin, "dev", "--hostname", "0.0.0.0", "--port", String(port)]);
