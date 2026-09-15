export function catalogPhotoPath(sku: string) {
  return `/catalog/${encodeURIComponent(sku)}.jpg`;
}

export function catalogPhotoFallback(sku: string) {
  return `/product-art/${encodeURIComponent(sku)}`;
}
