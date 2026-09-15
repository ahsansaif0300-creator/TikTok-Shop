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
    "/**": ["./prisma/demo.sqlite", "./scripts/copy-demo-db.mjs", "./scripts/bootstrap.mjs", "./public/catalog"],
  },
  async headers() {
    return [
      {
        source: "/distribution",
        headers: [{ key: "Cache-Control", value: "private, no-cache, must-revalidate" }],
      },
      {
        source: "/welcome",
        headers: [{ key: "Cache-Control", value: "private, no-cache, must-revalidate" }],
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
