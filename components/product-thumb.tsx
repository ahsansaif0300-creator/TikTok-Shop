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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={productImageSrc(src, alt)}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-lg object-cover ring-1 ring-line"
      style={{ width: size, height: size }}
    />
  );
}
