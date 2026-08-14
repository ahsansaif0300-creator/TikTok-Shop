import type { NextConfig } from "next";

const previewHosts = [
  "*.agent.cvm.dev",
  "*.cursorvm.com",
  "p-3000-pod-cqhtshalizhexjeq7kymoxrpgy-29d9cf525c2f83e822f0-us7.agent.cvm.dev",
  "29d9cf525c2f83e822f0-pod-cqhtshalizhexjeq7kymoxrpgy-3000.us7.cursorvm.com",
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
