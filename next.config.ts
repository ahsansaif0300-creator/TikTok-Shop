import type { NextConfig } from "next";
import { extraAllowedOrigins, lanIPv4s } from "./scripts/lan-urls.mjs";

const shopBase = process.env.SHOP_BASE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");

const previewHosts = [
  "*.agent.cvm.dev",
  "*.cursorvm.com",
  "*.hostingersite.com",
  "*.hostinger-site.com",
  "*.hstgr.io",
  "*.hstgr.cloud",
  "*.hostinger.com",
  "*.local",
  ...(shopBase ? [shopBase, `*.${shopBase}`] : []),
  ...lanIPv4s(),
  ...extraAllowedOrigins(),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    "/**": ["./prisma/demo.sqlite", "./scripts/copy-demo-db.mjs", "./scripts/bootstrap.mjs", "./public/catalog", "./public/c4"],
  },
  async headers() {
    return [
      {
        source: "/orders",
        headers: [{ key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" }],
      },
      {
        source: "/orders/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" }],
      },
      {
        source: "/api/orders/live",
        headers: [{ key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" }],
      },
      {
        source: "/ol1",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/welcome",
        headers: [{ key: "Cache-Control", value: "private, no-cache, must-revalidate" }],
      },
      {
        source: "/signup",
        headers: [{ key: "Cache-Control", value: "private, no-cache, must-revalidate" }],
      },
      {
        source: "/catalog/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" }],
      },
      {
        source: "/c4/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" }],
      },
    ];
  },
  allowedDevOrigins: previewHosts,
    experimental: {
    serverActions: {
      allowedOrigins: previewHosts,
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
