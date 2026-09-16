import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pricedDistributionCatalog, pricedExtraProducts } from "../lib/distribution-catalog";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "public", "catalog");
mkdirSync(destDir, { recursive: true });

const rows = [...pricedDistributionCatalog(), ...pricedExtraProducts()].map((row) => ({
  sku: row.sku,
  title: row.title,
  category: row.category,
}));
const indexPath = path.join(root, "scripts", "catalog-index.json");
writeFileSync(indexPath, JSON.stringify(rows, null, 2));

const py = path.join(root, "scripts", "render-realistic-catalog.py");
const result = spawnSync("python3", [py, indexPath, destDir], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
