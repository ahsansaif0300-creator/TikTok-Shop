import { readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { productArtSvg } from "../lib/product-art";
import { pricedDistributionCatalog, pricedExtraProducts } from "../lib/distribution-catalog";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "public", "catalog");

async function toJpeg(input: Buffer, dest: string) {
  await sharp(input).resize(800, 800, { fit: "cover", position: "centre" }).jpeg({ quality: 82 }).toFile(dest);
}

async function fillFromCommons(title: string, dest: string) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&gsrsearch=" +
    encodeURIComponent(title);
  const res = await fetch(url, {
    headers: { "User-Agent": "TikiTokShop/1.0 (catalog photos)", Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string; mime?: string }[] }> };
  };
  for (const page of Object.values(data.query?.pages ?? {})) {
    const src = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
    if (!src) continue;
    const img = await fetch(src, { signal: AbortSignal.timeout(12000) });
    if (!img.ok) continue;
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length < 2000) continue;
    try {
      await toJpeg(buf, dest);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function main() {
  const files = readdirSync(destDir).filter((name) => name.endsWith(".jpg"));
  for (const name of files) {
    const full = path.join(destDir, name);
    try {
      await toJpeg(await sharp(full).toBuffer(), full);
    } catch (error) {
      console.warn("convert fail", name, error);
    }
  }
  const rows = [...pricedDistributionCatalog(), ...pricedExtraProducts()];
  let filled = 0;
  let generated = 0;
  for (const row of rows) {
    const dest = path.join(destDir, `${row.sku}.jpg`);
    if (existsSync(dest)) continue;
    if (await fillFromCommons(`${row.title} ${row.category}`, dest)) {
      filled += 1;
      continue;
    }
    const svg = productArtSvg(row.sku);
    await toJpeg(Buffer.from(svg), dest);
    generated += 1;
  }
  console.log(`jpeg catalog files=${readdirSync(destDir).length} commons=${filled} generated=${generated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
