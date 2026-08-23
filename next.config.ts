import type { NextConfig } from "next";
import { extraAllowedOrigins, lanIPv4s } from "./scripts/lan-urls.mjs";

const previewHosts = [
  "*.agent.cvm.dev",
  "*.cursorvm.com",
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
