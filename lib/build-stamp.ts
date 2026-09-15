import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export function buildStamp() {
  try {
    const file = path.join(process.cwd(), ".next", "BUILD_ID");
    if (!existsSync(file)) return "dev";
    return readFileSync(file, "utf8").trim().slice(0, 10);
  } catch {
    return "dev";
  }
}
