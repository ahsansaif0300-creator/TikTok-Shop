function cleanDomain(value: string | undefined) {
  return (value ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

/** Hostnames that should never be treated as a shop slug. */
export function shopSlugFromHost(host: string, shopBaseDomain?: string) {
  const base = cleanDomain(shopBaseDomain ?? process.env.SHOP_BASE_DOMAIN);
  if (!base) return null;
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  if (!hostname || hostname === base || hostname === `www.${base}`) return null;
  const suffix = `.${base}`;
  if (!hostname.endsWith(suffix)) return null;
  const slug = hostname.slice(0, -suffix.length);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug)) return null;
  if (slug.includes(".")) return null;
  return slug;
}

export function shopBaseDomain() {
  return cleanDomain(process.env.SHOP_BASE_DOMAIN) || null;
}
