export const DUMMY_PRODUCT_IMAGES = Array.from(
  { length: 20 },
  (_, index) => `/products/p${String(index + 1).padStart(2, "0")}.jpg`,
);

export function dummyProductImage(key: string) {
  if (!key) return DUMMY_PRODUCT_IMAGES[0];
  let hash = 0;
  for (const char of key) hash = (hash + char.charCodeAt(0) * 13) % DUMMY_PRODUCT_IMAGES.length;
  return DUMMY_PRODUCT_IMAGES[hash];
}

export function productImageSrc(image?: string | null, key = "") {
  return image && image.length > 0 ? image : dummyProductImage(key);
}
