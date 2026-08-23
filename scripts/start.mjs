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

run(process.execPath, [path.join(root, "scripts", "bootstrap.mjs")]);

const port = resolvePort();
printAccessUrls(port);
const nextBin = require.resolve("next/dist/bin/next");
run(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", String(port)]);
