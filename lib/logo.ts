const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_LOGO_BYTES = 1_500_000;

export function logoError(file: File | null) {
  if (!file || file.size === 0) return "missing";
  if (!ALLOWED.has(file.type)) return "type";
  if (file.size > MAX_LOGO_BYTES) return "size";
  return null;
}

export async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}
