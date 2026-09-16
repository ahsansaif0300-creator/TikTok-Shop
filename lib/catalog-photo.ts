export const CATALOG_PHOTO_VERSION = "c4";

export function catalogPhotoPath(sku: string) {
  return `/c4/${encodeURIComponent(sku)}.jpg`;
}

export function catalogPhotoFallback(sku: string) {
  return `/product-art/${encodeURIComponent(sku)}?v=${CATALOG_PHOTO_VERSION}`;
}

/** Hostinger caches /catalog/*.jpg by path. Always use the live /c4/ URL. */
export function rewriteCatalogImage(src: string) {
  const match = src.match(/\/(?:catalog|c4)\/([^/?#]+?)(?:\.jpg)?(?:\?.*)?$/i);
  if (!match) return src;
  const sku = decodeURIComponent(match[1].replace(/\.jpg$/i, ""));
  if (!sku) return src;
  return catalogPhotoPath(sku);
}
