"use client";

import { catalogPhotoFallback } from "@/lib/catalog-photo";
import { productImageSrc } from "@/lib/product-image";

export function ProductThumb({
  src,
  alt,
  size = 44,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  const resolved = productImageSrc(src, alt);
  const file = typeof src === "string" ? src.split("?")[0]?.split("/").pop() : "";
  const sku = file?.replace(/\.[a-z]+$/i, "") ?? "";
  const fallback = sku ? catalogPhotoFallback(decodeURIComponent(sku)) : productImageSrc("", alt);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-lg bg-soft object-cover ring-1 ring-line"
      style={{ width: size, height: size }}
      onError={(event) => {
        if (event.currentTarget.dataset.fallback === "1") return;
        event.currentTarget.dataset.fallback = "1";
        event.currentTarget.src = fallback;
      }}
    />
  );
}
