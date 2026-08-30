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
    "/**": ["./prisma/demo.sqlite", "./scripts/copy-demo-db.mjs", "./scripts/bootstrap.mjs"],
  },
  allowedDevOrigins: previewHosts,
    experimental: {
    serverActions: {
      allowedOrigins: previewHosts,
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
