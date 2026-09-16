import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { pricedDistributionCatalog, pricedExtraProducts } from "../lib/distribution-catalog";
import {
  rankedStock,
  titleTokens,
  wikiQueries,
  hayHasHead,
  headNoun,
  synonymsFor,
  isGenericHead,
  CURATED_SKU_PHOTOS,
} from "./catalog-stock-photos";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "public", "catalog");
mkdirSync(destDir, { recursive: true });

const UA = "TikTokShop/1.0 (catalog photos; https://tikitokshop.site)";
const SIZE = 900;
const MIN_BYTES = 8000;

type Row = { sku: string; title: string; category: string; blurb: string };
type Candidate = { url: string; score: number; source: string };

const used = new Set<string>();
const dummyCache: { title: string; urls: string[] }[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get(url: string, timeout = 20000, accept = "*/*") {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept },
    signal: AbortSignal.timeout(timeout),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response;
}

async function loadDummyJson() {
  try {
    const res = await get("https://dummyjson.com/products?limit=200", 20000, "application/json");
    const data = (await res.json()) as { products: { title: string; images?: string[] }[] };
    for (const product of data.products ?? []) {
      const urls = (product.images ?? []).filter(Boolean);
      if (urls.length) dummyCache.push({ title: product.title, urls });
    }
  } catch (error) {
    console.warn("dummyjson skipped", error);
  }
}

const MATERIALS = new Set([
  "silicone",
  "leather",
  "cotton",
  "wool",
  "linen",
  "gold",
  "silver",
  "steel",
  "wooden",
  "oak",
  "metal",
  "plastic",
  "nylon",
  "canvas",
  "merino",
  "cashmere",
  "organic",
  "usb",
  "led",
  "mini",
]);

function dummyScore(productTitle: string, dummyTitle: string) {
  if (!hayHasHead(productTitle, dummyTitle)) return 0;
  const left = titleTokens(productTitle).filter((token) => !MATERIALS.has(token));
  const right = titleTokens(dummyTitle);
  let overlap = 0;
  for (const token of left) {
    const options = synonymsFor(token);
    if (right.some((other) => other === token || options.includes(other))) overlap += 1;
  }
  if (isGenericHead(productTitle) && overlap < 2) return 0;
  if (overlap < 1) return 0;
  return overlap + 2;
}

function rejectName(name: string, productTitle: string) {
  const file = name.toLowerCase();
  const kids = /child|baby|mother|toy/i.test(productTitle);
  if (/diagram|chart|logo|icon|svg|pdf|screenshot|map\b|flag|coat of arms|qr code|infographic|drawing|cartoon|comic|heatmap|waveform|simulation|consulting|graph |plot |sketch|engraving|illustration|conference|audience|meeting|lecture|classroom|deadlift|barbell workout|hare|rabbit|wildlife|aquarium|fish |bird |kodak|brownie/.test(file)) {
    return true;
  }
  if (/portrait|selfie|crowd|mugshot|navy|sailor|military|crew|ship |boat /.test(file)) return true;
  if (!kids && /\b(woman|women|man|men|girl|boy|person|people|wearing|holding|portrait)\b/.test(file)) return true;
  return false;
}

function wikiScore(fileTitle: string, productTitle: string) {
  if (rejectName(fileTitle, productTitle)) return -10;
  if (!hayHasHead(productTitle, fileTitle)) return 0;
  const tokens = titleTokens(productTitle);
  const file = fileTitle.toLowerCase();
  let score = 2;
  for (const token of tokens) {
    if (new RegExp(`\\b${token}s?\\b`, "i").test(file)) score += token.length > 6 ? 2 : 1;
  }
  if (/isolated|white background|product photography/.test(file)) score += 1;
  const head = headNoun(productTitle);
  if (["cable", "light", "kit", "case", "bag", "clip", "mount", "stand"].includes(head) && score < 5) return 0;
  return score;
}

async function wikiCandidates(row: Row): Promise<Candidate[]> {
  const found: Candidate[] = [];
  for (const query of wikiQueries(row.title, row.category).slice(0, 4)) {
    const url =
      "https://commons.wikimedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrnamespace: "6",
        gsrlimit: "8",
        prop: "imageinfo",
        iiprop: "url|mime|size",
        iiurlwidth: "1200",
        gsrsearch: `${query} filetype:bitmap`,
      });
    try {
      const res = await get(url, 15000, "application/json");
      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            { title?: string; imageinfo?: { thumburl?: string; url?: string; mime?: string; width?: number }[] }
          >;
        };
      };
      for (const page of Object.values(data.query?.pages ?? {})) {
        const info = page.imageinfo?.[0];
        const mime = info?.mime ?? "";
        if (!/^image\/(jpeg|png|webp|jpg)/.test(mime)) continue;
        const src = info?.thumburl || info?.url;
        if (!src) continue;
        const score = wikiScore(page.title ?? "", row.title);
        if (score < 2) continue;
        found.push({ url: src, score: score + 3, source: "wiki" });
      }
    } catch {
      // keep looking
    }
    await sleep(120);
  }
  found.sort((a, b) => b.score - a.score);
  return found;
}

async function openverseCandidates(row: Row): Promise<Candidate[]> {
  const query = wikiQueries(row.title, row.category)[0];
  if (!query) return [];
  const url =
    "https://api.openverse.org/v1/images/?" +
    new URLSearchParams({
      q: query,
      category: "photograph",
      page_size: "8",
      mature: "false",
    });
  try {
    const res = await get(url, 15000, "application/json");
    const data = (await res.json()) as {
      results?: { url?: string; title?: string; tags?: { name?: string }[]; width?: number; height?: number }[];
    };
    const found: Candidate[] = [];
    for (const item of data.results ?? []) {
      if (!item.url) continue;
      const blob = `${item.title ?? ""} ${(item.tags ?? []).map((tag) => tag.name).join(" ")}`;
      if (rejectName(blob, row.title)) continue;
      const score = wikiScore(blob, row.title);
      if (score < 2) continue;
      found.push({ url: item.url, score: score + 1, source: "openverse" });
    }
    return found.sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

function pollinationsUrl(row: Row, attempt: number) {
  const clothing = /clothing|dress|jacket|shirt|coat|sweater|hoodie|pant|jean|tee|polo|onesie|tutu/i.test(
    `${row.title} ${row.category}`,
  );
  const prompt = clothing
    ? `overhead flat lay ecommerce photo of a single ${row.title}, ${row.blurb} one garment only, centered, white background, no person, no face, no mannequin, no text, no watermark`
    : `photorealistic ecommerce catalog listing photo of ${row.title}. ${row.blurb} Single retail product, centered, studio catalog lighting, clean backdrop, no person, no hands, no text overlay, no watermark`;
  const seed = [...row.sku].reduce((sum, char) => sum + char.charCodeAt(0), 0) + attempt * 97;
  return (
    "https://image.pollinations.ai/prompt/" +
    encodeURIComponent(prompt) +
    `?width=1024&height=1024&nologo=true&nofeed=true&seed=${seed}`
  );
}

async function pollinationsCandidate(row: Row): Promise<Candidate | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = pollinationsUrl(row, attempt);
    try {
      const res = await get(url, 50000, "image/jpeg,image/*,*/*");
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 8000 || buf[0] !== 0xff || buf[1] !== 0xd8) {
        throw new Error("not jpeg");
      }
      const dest = path.join(destDir, `${row.sku}.jpg`);
      const image = sharp(buf, { failOn: "none" });
      const meta = await image.metadata();
      const width = meta.width ?? 768;
      const height = meta.height ?? 768;
      const cropped = await image
        .extract({ left: 0, top: 0, width, height: Math.max(40, Math.floor(height * 0.88)) })
        .toBuffer();
      await toStudioJpeg(cropped, dest);
      if (statSync(dest).size < MIN_BYTES) throw new Error("tiny");
      return { url, score: 8, source: "studio" };
    } catch (error) {
      const message = String(error);
      if (message.includes("429")) await sleep(10000);
      else await sleep(1500);
    }
  }
  return null;
}

function curatedCandidates(row: Row): Candidate[] {
  return (CURATED_SKU_PHOTOS[row.sku] ?? []).map((url) => ({
    url,
    score: 20,
    source: "wiki",
  }));
}

function localCandidates(row: Row): Candidate[] {
  const found: Candidate[] = [...curatedCandidates(row)];
  for (const { photo, score } of rankedStock(row.title)) {
    found.push({ url: photo.url, score: score + 4, source: "unsplash" });
  }
  for (const product of dummyCache) {
    const score = dummyScore(row.title, product.title);
    if (score < 2) continue;
    for (const url of product.urls) {
      found.push({ url, score, source: "dummyjson" });
    }
  }
  return found.sort((a, b) => b.score - a.score);
}

async function toStudioJpeg(input: Buffer, dest: string) {
  const stats = await sharp(input, { failOn: "none" }).resize(48, 48, { fit: "fill" }).stats();
  const bright = stats.channels.slice(0, 3).every((channel) => channel.mean > 200);
  if (bright) {
    const fitted = await sharp(input, { failOn: "none" })
      .rotate()
      .resize(SIZE - 48, SIZE - 48, { fit: "inside", withoutEnlargement: false, background: "#ffffff" })
      .png()
      .toBuffer();
    await sharp({
      create: { width: SIZE, height: SIZE, channels: 3, background: "#ffffff" },
    })
      .composite([{ input: fitted, gravity: "centre" }])
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(dest);
    return;
  }
  await sharp(input, { failOn: "none" })
    .rotate()
    .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(dest);
}

async function downloadToJpeg(url: string, dest: string) {
  const res = await get(url, 25000, "image/*,*/*");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2500) throw new Error("tiny");
  await toStudioJpeg(buf, dest);
  if (!existsSync(dest) || statSync(dest).size < MIN_BYTES) {
    throw new Error("jpeg too small");
  }
}

async function tryPool(row: Row, pool: Candidate[]) {
  const dest = path.join(destDir, `${row.sku}.jpg`);
  for (const candidate of pool) {
    const unique = candidate.source !== "unsplash" && candidate.source !== "wiki";
    if (unique && used.has(candidate.url)) continue;
    try {
      await downloadToJpeg(candidate.url, dest);
      used.add(candidate.url);
      return candidate.source;
    } catch {
      used.add(candidate.url);
    }
  }
  return null;
}

async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
}

async function main() {
  const allRows: Row[] = [...pricedDistributionCatalog(), ...pricedExtraProducts()].map((row) => ({
    sku: row.sku,
    title: row.title,
    category: row.category,
    blurb: row.blurb,
  }));
  const skuFilter = new Set((process.env.CATALOG_PHOTO_SKUS || "").split(",").map((value) => value.trim()).filter(Boolean));
  const rows = skuFilter.size ? allRows.filter((row) => skuFilter.has(row.sku)) : allRows;
  const skipLocal = process.env.CATALOG_PHOTO_SKIP_LOCAL === "1";
  console.log(`Matching ${rows.length} catalog photos to product titles…`);
  await loadDummyJson();
  const counts: Record<string, number> = { unsplash: 0, dummyjson: 0, studio: 0, wiki: 0, openverse: 0, miss: 0 };
  const pending: Row[] = [];
  for (const row of rows) {
    if (skipLocal) {
      pending.push(row);
      continue;
    }
    const source = await tryPool(row, localCandidates(row));
    if (source) {
      counts[source] = (counts[source] ?? 0) + 1;
      console.log(`  ${row.sku}  ${source}  ${row.title}`);
    } else {
      pending.push(row);
    }
  }
  console.log(`Local matches ${rows.length - pending.length}. Searching title-matched photos for ${pending.length} products…`);
  let done = rows.length - pending.length;
  for (const row of pending) {
    const remote = [...curatedCandidates(row), ...(await wikiCandidates(row)), ...(await openverseCandidates(row))];
    const source = await tryPool(row, remote);
    done += 1;
    if (source) {
      counts[source] = (counts[source] ?? 0) + 1;
      console.log(`  ${row.sku}  ${source}  ${row.title}`);
    } else {
      counts.miss += 1;
      console.warn("miss", row.sku, row.title);
    }
    if (done % 10 === 0 || done === rows.length) {
      console.log(
        `  ${done}/${rows.length}  unsplash=${counts.unsplash} dummy=${counts.dummyjson} wiki=${counts.wiki} studio=${counts.studio} miss=${counts.miss}`,
      );
    }
  }
  writeFileSync(
    path.join(root, "scripts", "catalog-photo-report.json"),
    JSON.stringify({ counts, total: rows.length, pending: pending.length }, null, 2),
  );
  console.log("done", counts);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
