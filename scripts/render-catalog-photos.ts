import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pricedDistributionCatalog, pricedExtraProducts } from "../lib/distribution-catalog";
import { productPhotoSvg } from "../lib/product-photo";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "public", "catalog");

async function main() {
  const sharp = (await import("sharp")).default;
  mkdirSync(destDir, { recursive: true });
  const rows = [...pricedDistributionCatalog(), ...pricedExtraProducts()];
  for (const row of rows) {
    const svg = productPhotoSvg(row.title, row.category, row.sku);
    const dest = path.join(destDir, `${row.sku}.jpg`);
    await sharp(Buffer.from(svg))
      .resize(800, 800)
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(dest);
  }
  console.log(`Wrote ${rows.length} catalog photos to public/catalog`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
