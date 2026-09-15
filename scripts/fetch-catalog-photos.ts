import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pricedDistributionCatalog, pricedExtraProducts } from "../lib/distribution-catalog";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "public", "catalog");
mkdirSync(destDir, { recursive: true });

const MAP: Record<string, string[]> = {
  "Hot Selling Items": ["kitchen-accessories", "home-decoration", "groceries"],
  "Computer accessories": ["laptops", "tablets", "smartphones"],
  "Home cabinets": ["furniture", "home-decoration", "kitchen-accessories"],
  "Health Products": ["skin-care", "groceries", "beauty"],
  "Men's clothing": ["mens-shirts", "mens-shoes", "mens-watches"],
  "Women's clothing": ["womens-dresses", "tops", "womens-shoes"],
  "Snacks and desserts": ["groceries"],
  "Mobile accessories": ["mobile-accessories", "smartphones"],
  "Children's toys": ["motorcycle", "vehicle", "sports-accessories"],
  Beverages: ["groceries"],
  "Office supplies": ["furniture", "laptops", "tablets"],
  "Digital products": ["smartphones", "tablets", "laptops"],
  "Beauty and skincare": ["beauty", "skin-care", "fragrances"],
  "Mother and baby products": ["beauty", "skin-care", "groceries"],
  "Jewelry and watches": ["womens-jewellery", "mens-watches", "womens-watches"],
  "Luxury goods": ["sunglasses", "fragrances", "womens-bags", "womens-watches"],
  "Children's clothing": ["tops", "womens-dresses", "mens-shirts"],
  "Men's bags": ["mens-shoes", "mens-watches", "sunglasses"],
  "Women's bags": ["womens-bags", "womens-jewellery"],
  "Fitness Equipment": ["sports-accessories"],
};

type DJ = { category: string; images: string[]; title: string };

async function main() {
  const res = await fetch("https://dummyjson.com/products?limit=200");
  if (!res.ok) throw new Error(`dummyjson ${res.status}`);
  const data = (await res.json()) as { products: DJ[] };
  const byCat = new Map<string, string[]>();
  const all: string[] = [];
  for (const product of data.products) {
    for (const image of product.images ?? []) {
      if (!image) continue;
      const list = byCat.get(product.category) ?? [];
      list.push(image);
      byCat.set(product.category, list);
      all.push(image);
    }
  }
  const used = new Set<string>();
  const rows = [...pricedDistributionCatalog(), ...pricedExtraProducts()];

  function take(category: string) {
    for (const slug of MAP[category] ?? []) {
      const pool = byCat.get(slug) ?? [];
      const next = pool.find((url) => !used.has(url));
      if (next) {
        used.add(next);
        return next;
      }
    }
    const next = all.find((url) => !used.has(url));
    if (next) {
      used.add(next);
      return next;
    }
    return null;
  }

  async function download(url: string, dest: string) {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return false;
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length < 1500) return false;
    writeFileSync(dest, buf);
    return true;
  }

  let ok = 0;
  let miss = 0;
  for (const row of rows) {
    const dest = path.join(destDir, `${row.sku}.jpg`);
    if (existsSync(dest)) {
      ok += 1;
      continue;
    }
    const url = take(row.category);
    if (!url) {
      miss += 1;
      console.warn("no url", row.sku, row.title);
      continue;
    }
    if (await download(url, dest)) {
      ok += 1;
    } else {
      miss += 1;
      used.delete(url);
      console.warn("download fail", row.sku, url);
    }
  }
  console.log(`done saved=${ok} missing=${miss} total=${rows.length} uniqueUrls=${used.size}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
