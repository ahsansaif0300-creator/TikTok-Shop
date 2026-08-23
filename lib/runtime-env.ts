import { randomBytes } from "node:crypto";
import path from "node:path";

function sqliteFileFromUrl(url: string) {
  const rest = url.replace(/^file:/, "");
  return rest;
}

export function applyRuntimeEnv(root = process.cwd()) {
  const raw = (process.env.DATABASE_URL || "file:./dev.db").trim();
  if (raw.startsWith("file:")) {
    let filePath = sqliteFileFromUrl(raw);
    if (!path.isAbsolute(filePath)) {
      const normalized = filePath.replace(/^\.\//, "");
      filePath =
        normalized === "dev.db"
          ? path.join(root, "prisma", "dev.db")
          : path.resolve(root, normalized);
    }
    process.env.DATABASE_URL = `file:${filePath}`;
  }

  if (!process.env.AUTH_SECRET?.trim()) {
    process.env.AUTH_SECRET = randomBytes(32).toString("hex");
    console.warn(
      "[harbor] AUTH_SECRET was not set. Generated a temporary secret for this process. Set AUTH_SECRET in Hostinger Environment variables so logins survive restarts.",
    );
  }
}

export function sqliteFilePath(root = process.cwd()) {
  applyRuntimeEnv(root);
  const url = process.env.DATABASE_URL || "file:./dev.db";
  if (!url.startsWith("file:")) return path.join(root, "prisma", "dev.db");
  return sqliteFileFromUrl(url);
}
