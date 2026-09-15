export const CATALOG_PHOTO_VERSION = "match-title";

export function catalogPhotoPath(sku: string) {
  return `/catalog/${encodeURIComponent(sku)}.jpg?v=${CATALOG_PHOTO_VERSION}`;
}

export function catalogPhotoFallback(sku: string) {
  return `/product-art/${encodeURIComponent(sku)}?v=${CATALOG_PHOTO_VERSION}`;
}
