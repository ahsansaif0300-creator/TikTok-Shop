import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zipPath = path.join(root, "harbor-hostinger.zip");

if (existsSync(zipPath)) unlinkSync(zipPath);

const excludes = [
  "node_modules/*",
  ".git/*",
  ".next/*",
  "prisma/*.db",
  "prisma/*.db-journal",
  ".env",
  ".env.*",
  "harbor-hostinger.zip",
];

const args = ["-r", zipPath, "."];
for (const pattern of excludes) {
  args.push("-x", pattern);
}

const result = spawnSync("zip", args, { cwd: root, stdio: "inherit" });
if (result.status !== 0) {
  console.error("zip failed. Install zip, or upload the GitHub repo in hPanel instead.");
  process.exit(result.status ?? 1);
}

console.log(`\nUpload this archive in hPanel → Node.js web app → Upload your files:\n  ${zipPath}\n`);
console.log("Then paste hostinger.env.example into Environment variables. Do not unzip into public_html.");
