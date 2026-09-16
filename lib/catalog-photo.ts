export const CATALOG_PHOTO_VERSION = "photo-white-1";

export function catalogPhotoPath(sku: string) {
  return `/catalog/${encodeURIComponent(sku)}.jpg?v=${CATALOG_PHOTO_VERSION}`;
}

export function catalogPhotoFallback(sku: string) {
  return `/product-art/${encodeURIComponent(sku)}?v=${CATALOG_PHOTO_VERSION}`;
}
