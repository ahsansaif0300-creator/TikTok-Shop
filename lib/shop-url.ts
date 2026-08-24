import { headers } from "next/headers";
import { shopBaseDomain } from "@/lib/shop-host";

export function shopPath(slug: string) {
  return `/s/${slug}`;
}

export async function requestOrigin() {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const forwarded = h.get("x-forwarded-proto");
  const proto =
    forwarded ??
    (host.includes("localhost") ||
    host.startsWith("127.") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

export async function shopAbsoluteUrl(slug: string) {
  const base = shopBaseDomain();
  if (base) return `https://${slug}.${base}`;
  return `${await requestOrigin()}${shopPath(slug)}`;
}

export async function workspaceLoginUrl(shopSlug?: string) {
  const origin = await requestOrigin();
  const q = shopSlug ? `?shop=${encodeURIComponent(shopSlug)}` : "";
  return `${origin}/login${q}`;
}
