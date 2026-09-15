import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_SUPPORT_IMAGE_BYTES = 5_000_000;
export const MAX_SUPPORT_VIDEO_BYTES = 20_000_000;

const IMAGE_MIME = new Map([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const VIDEO_MIME = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
]);

export const SUPPORT_UPLOAD_ROOT = path.join(process.cwd(), "data", "support");

function sniffKind(buffer: Buffer, mime: string) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "IMAGE";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "IMAGE";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "IMAGE";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "IMAGE";
  if (buffer.toString("ascii", 4, 8) === "ftyp") return "VIDEO";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "VIDEO";
  if (mime.startsWith("image/") && IMAGE_MIME.has(mime)) return "IMAGE";
  if (mime.startsWith("video/") && VIDEO_MIME.has(mime)) return "VIDEO";
  return null;
}

export function supportMediaError(file: File | null) {
  if (!file || file.size === 0) return null;
  const mime = (file.type || "").toLowerCase();
  if (!mime) {
    if (file.size > MAX_SUPPORT_VIDEO_BYTES) return "size";
    return null;
  }
  if (IMAGE_MIME.has(mime)) {
    if (file.size > MAX_SUPPORT_IMAGE_BYTES) return "size";
    return null;
  }
  if (VIDEO_MIME.has(mime)) {
    if (file.size > MAX_SUPPORT_VIDEO_BYTES) return "size";
    return null;
  }
  return "type";
}

export async function saveSupportUpload(merchantId: string, file: File) {
  const mime = (file.type || "").toLowerCase();
  const problem = supportMediaError(file);
  if (problem) return { error: problem as "type" | "size" };
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = sniffKind(buffer, mime);
  if (!kind) return { error: "type" as const };
  if (kind === "IMAGE" && buffer.length > MAX_SUPPORT_IMAGE_BYTES) return { error: "size" as const };
  if (kind === "VIDEO" && buffer.length > MAX_SUPPORT_VIDEO_BYTES) return { error: "size" as const };
  const ext = IMAGE_MIME.get(mime) ?? VIDEO_MIME.get(mime) ?? (kind === "VIDEO" ? "mp4" : "jpg");
  const storedMime = mime || (kind === "VIDEO" ? "video/mp4" : "image/jpeg");
  const id = randomBytes(16).toString("hex");
  const checksum = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const relative = path.join(merchantId.replace(/[^a-zA-Z0-9_-]/g, ""), `${id}-${checksum}.${ext}`);
  const dest = path.join(SUPPORT_UPLOAD_ROOT, relative);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buffer, { mode: 0o600 });
  return { kind, mime: storedMime, relative: relative.replaceAll("\\", "/") };
}

export function resolveSupportUpload(relative: string) {
  const root = path.resolve(SUPPORT_UPLOAD_ROOT);
  const dest = path.resolve(root, relative);
  if (dest !== root && !dest.startsWith(`${root}${path.sep}`)) return null;
  return dest;
}
