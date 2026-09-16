import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export const RELEASE_LABEL = "tiktok-shop-photos";

export function buildStamp() {
  try {
    const file = path.join(process.cwd(), ".next", "BUILD_ID");
    if (!existsSync(file)) return `${RELEASE_LABEL}-dev`;
    return `${RELEASE_LABEL}-${readFileSync(file, "utf8").trim().slice(0, 10)}`;
  } catch {
    return `${RELEASE_LABEL}-dev`;
  }
}
