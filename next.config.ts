import type { NextConfig } from "next";

const previewHosts = ["*.agent.cvm.dev", "*.cursorvm.com"];

const nextConfig: NextConfig = {
  allowedDevOrigins: previewHosts,
  experimental: {
    serverActions: {
      allowedOrigins: previewHosts,
    },
  },
};

export default nextConfig;
