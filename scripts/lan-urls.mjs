import os from "node:os";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadLocalEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadLocalEnv();

export function lanIPv4s() {
  const ips = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      const v4 = addr.family === "IPv4" || addr.family === 4;
      if (v4 && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}

export function extraAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function printAccessUrls(port = process.env.PORT || "3000") {
  const ips = lanIPv4s();
  console.log("");
  console.log("Open Harbor:");
  console.log(`  On this computer:     http://127.0.0.1:${port}/login`);
  if (ips.length) {
    for (const ip of ips) {
      console.log(`  On your phone/Wi-Fi:  http://${ip}:${port}/login`);
    }
  } else {
    console.log("  On your phone/Wi-Fi:  run `ipconfig` (Windows) or `hostname -I` (Mac/Linux) and use that IPv4");
  }
  console.log("  http://localhost:... only works on THIS computer, not on other devices.");
  console.log("");
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  printAccessUrls();
}
