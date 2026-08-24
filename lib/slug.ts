const RESERVED_SHOP_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "login",
  "signup",
  "s",
  "harbor",
  "static",
  "mail",
  "ftp",
  "support",
  "help",
  "status",
  "cdn",
  "merchants",
  "orders",
  "products",
  "dashboard",
  "shop",
]);

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return slug || "shop";
}

export async function uniqueMerchantSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
) {
  const base = slugify(name);
  const root = RESERVED_SHOP_SLUGS.has(base) ? `${base}-store` : base;
  let slug = root;
  let n = 2;
  while (await exists(slug)) {
    slug = `${root}-${n}`;
    n += 1;
  }
  return slug;
}
