import { catalogRowForSku } from "@/lib/distribution-catalog";
import { productArtSvg } from "@/lib/product-art";
import { productPhotoSvg } from "@/lib/product-photo";

export async function GET(_request: Request, context: { params: Promise<{ sku: string }> }) {
  const { sku } = await context.params;
  const decoded = decodeURIComponent(sku);
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(decoded)) {
    return new Response("Not found", { status: 404 });
  }
  const row = catalogRowForSku(decoded);
  const svg = row ? productPhotoSvg(row.title, row.category, row.sku) : productArtSvg(decoded);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
