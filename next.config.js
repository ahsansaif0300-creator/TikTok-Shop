const os = require("os");

function lanIPv4s() {
  try {
    const ips = [];
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const addr of addrs ?? []) {
        const v4 = addr.family === "IPv4" || addr.family === 4;
        if (v4 && !addr.internal) ips.push(addr.address);
      }
    }
    return ips;
  } catch {
    return [];
  }
}

function extraAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function hostFromAppBase() {
  const raw = process.env.APP_BASE_URL?.trim();
  if (!raw) return [];
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");
    return host ? [host, `www.${host}`] : [];
  } catch {
    return [];
  }
}

const shopBase = process.env.SHOP_BASE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");

const previewHosts = [
  "*.agent.cvm.dev",
  "*.cursorvm.com",
  "*.hostingersite.com",
  "*.hostinger-site.com",
  "*.hstgr.io",
  "*.hstgr.cloud",
  "*.hostinger.com",
  "*.onrender.com",
  "*.railway.app",
  "*.up.railway.app",
  "*.local",
  ...(shopBase ? [shopBase, `*.${shopBase}`] : []),
  ...hostFromAppBase(),
  ...lanIPv4s(),
  ...extraAllowedOrigins(),
];

const nextConfig = {
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

module.exports = nextConfig;
