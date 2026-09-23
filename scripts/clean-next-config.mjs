import { readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const name of readdirSync(root)) {
  if (!/^[a-z0-9]{6,}\.next\.config\.(ts|js|mjs|cjs)$/i.test(name)) continue;
  try {
    unlinkSync(path.join(root, name));
    console.log("[harbor] Removed leftover Next config", name);
  } catch (error) {
    console.warn("[harbor] Could not remove leftover Next config", name, error);
  }
}
