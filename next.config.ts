import type { NextConfig } from "next";
import { extraAllowedOrigins, lanIPv4s } from "./scripts/lan-urls.mjs";

const previewHosts = [
  "*.agent.cvm.dev",
  "*.cursorvm.com",
  "*.hostingersite.com",
  "*.hostinger-site.com",
  "*.hstgr.io",
  "*.hstgr.cloud",
  "*.hostinger.com",
  "*.local",
  ...lanIPv4s(),
  ...extraAllowedOrigins(),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: previewHosts,
  experimental: {
    serverActions: {
      allowedOrigins: previewHosts,
    },
  },
};

export default nextConfig;
