#!/usr/bin/env node
/**
 * Phase checklist runner for TikTok Shop.
 *   node scripts/verify-phases.mjs           # files + seed + lifecycle (phases 1–7)
 *   node scripts/verify-phases.mjs --http    # also hit a running server (phases 2–7)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const httpMode = process.argv.includes("--http");
const baseUrl = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";

const results = [];
let failed = 0;

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function ok(phase, name) {
  results.push({ phase, name, pass: true });
  console.log(`  ✓  ${name}`);
}

function fail(phase, name, error) {
  failed += 1;
  results.push({ phase, name, pass: false, error: String(error) });
  console.log(`  ✗  ${name}`);
  console.log(`     ${error}`);
}

async function check(phase, name, fn) {
  try {
    await fn();
    ok(phase, name);
  } catch (error) {
    fail(phase, name, error?.message || error);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return existsSync(path.join(root, rel));
}

function walkFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else if (/\.(ts|tsx|js|mjs|css|prisma)$/.test(entry)) acc.push(full);
  }
  return acc;
}

function sourceFiles() {
  const allowed = ["app/", "components/", "lib/", "prisma/", "proxy.ts", "next.config.ts", "next.config.mjs", "next.config.js"];
  return walkFiles(root).filter((file) => {
    const rel = path.relative(root, file);
    return allowed.some((prefix) => rel === prefix || rel.startsWith(prefix));
  });
}

function isNavActiveCheck(pathname, href, allHrefs) {
  if (href === "/") return pathname === "/";
  const matches = pathname === href || pathname.startsWith(`${href}/`);
  if (!matches) return false;
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}

function hasHref(html, href) {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`href="${escaped}"`).test(html);
}

function canChangeOrderCheck(from, to, via = "button") {
  if (via === "ship") {
    return to === "SHIPPED" && (from === "PAID" || from === "PROCESSING");
  }
  const next = {
    PENDING_PAYMENT: ["PAID", "CANCELLED"],
    PAID: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: ["COMPLETED"],
  };
  return (next[from] ?? []).includes(to);
}

function canOpenRefundCheck(status) {
  return status !== "PENDING_PAYMENT" && status !== "CANCELLED";
}

function canDecidePayoutCheck(from, action) {
  if (action === "APPROVED") return from === "PENDING";
  if (action === "REJECTED") return from === "PENDING" || from === "APPROVED";
  if (action === "PAID") return from === "APPROVED";
  return false;
}

// ---------------------------------------------------------------------------
// Phase 1
// ---------------------------------------------------------------------------
async function phase1Static() {
  console.log("\nPhase 1 — Foundation");
  const files = [
    "package.json",
    ".env.example",
    "prisma/schema.prisma",
    "prisma/seed.ts",
    "lib/auth.ts",
    "lib/db.ts",
    "lib/scope.ts",
    "proxy.ts",
    "scripts/bootstrap.mjs",
    "scripts/start.mjs",
    "instrumentation.ts",
    "lib/ensure-db.ts",
    "prisma/demo.sqlite",
    "app/login/page.tsx",
    "app/login/admin/page.tsx",
    "app/login/ops/page.tsx",
    "app/login/store/page.tsx",
    "app/login/support/page.tsx",
    "app/welcome/page.tsx",
    "next.config.js",
  ];
  await check(1, "Required foundation files exist", () => {
    const missing = files.filter((file) => !exists(file));
    assert(missing.length === 0, `Missing: ${missing.join(", ")}`);
  });
  await check(1, ".env.example documents DATABASE_URL, AUTH_SECRET, PORT", () => {
    const text = read(".env.example");
    for (const key of ["DATABASE_URL", "AUTH_SECRET", "PORT"]) {
      assert(text.includes(key), `Missing ${key}`);
    }
  });
  await check(1, "Schema has roles, orders, refunds, payouts, ledger", () => {
    const schema = read("prisma/schema.prisma");
    for (const token of [
      "enum Role",
      "SUPER_ADMIN",
      "OPS",
      "MERCHANT",
      "enum OrderStatus",
      "PENDING_PAYMENT",
      "COMPLETED",
      "enum RefundType",
      "RETURN_AND_REFUND",
      "enum PayoutStatus",
      "enum LedgerType",
      "model Merchant",
      "model Shipment",
      "availableBalance",
      "pendingBalance",
      "paymentPasswordHash",
      "SupportThread",
      "SupportSession",
      "model PaymentRelease",
      "walletReleased",
      "cnicNumber",
      "cnicImageFront",
      "cnicImageBack",
      "referralCode",
    ]) {
      assert(schema.includes(token), `Schema missing ${token}`);
    }
    assert(schema.includes("storeCode"), "Merchant storeCode missing");
    assert(!/inviteCode|yuebao|virtualOrder|blockchain/i.test(schema), "Schema contains out-of-scope fields");
  });
  await check(1, "JWT session cookie is harbor_session", () => {
    const auth = read("lib/auth.ts");
    assert(auth.includes('harbor_session'), "Cookie name missing");
    assert(auth.includes("SignJWT") && auth.includes("jwtVerify"), "jose JWT helpers missing");
  });
  await check(1, "proxy.ts redirects anonymous users to the matching login", () => {
    const proxy = read("proxy.ts") + read("lib/access.ts");
    assert(proxy.includes("loginPathForRequest"), "Login redirect helper missing");
    assert(proxy.includes("/login/admin") && proxy.includes("/login/store") && proxy.includes("/login/ops") && proxy.includes("/login/support"), "Separate login paths missing");
    assert(proxy.includes("harbor_session"), "Session cookie not read");
    assert(proxy.includes("canAccessPath"), "Role path gate missing");
  });
  await check(1, "No impersonation or trap-product code in app source", () => {
    const hits = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(file, "utf8").replace(/TikTok[\s-]?Shop/gi, "").replace(/TikiTok[\s-]?Shop/gi, "");
      if (/tiktok|bytedance|yuebao|yu'?e\s*bao|invite.?pyramid|virtual.?order|auto.?order|blockchain/i.test(text)) {
        hits.push(path.relative(root, file));
      }
    }
    assert(hits.length === 0, `Forbidden terms in: ${hits.join(", ")}`);
  });
}

async function phase1Database(prisma, bcrypt) {
  await check(1, "SQLite database file exists", () => {
    assert(exists("prisma/dev.db"), "prisma/dev.db is missing — run npm run setup");
  });
  await check(1, "Demo users exist with correct roles and passwords", async () => {
    const expected = [
      ["oscar.d@example.net", "SUPER_ADMIN", "HarborAdmin!2026", null],
      ["sarah.b@example.net", "OPS", "HarborOps!2026", null],
      ["iris.p@example.org", "MERCHANT", "HarborMerchant!2026", "northline-outfitters"],
    ];
    for (const [email, role, password, slug] of expected) {
      const user = await prisma.user.findUnique({ where: { email }, include: { merchant: true } });
      assert(user, `Missing user ${email}`);
      assert(user.role === role, `${email} role is ${user.role}, expected ${role}`);
      assert(await bcrypt.compare(password, user.passwordHash), `${email} password does not match seed`);
      if (slug) {
        assert(user.merchant?.slug === slug, `${email} is not linked to ${slug}`);
      } else {
        assert(!user.merchantId, `${email} should not be store-scoped`);
      }
    }
  });
  await check(1, "Workspace settings are seeded", async () => {
    const name = await prisma.setting.findUnique({ where: { key: "storeName" } });
    assert(name?.value === "TikiTok Shop", `storeName is ${name?.value}`);
  });
}

// ---------------------------------------------------------------------------
// Phase 2
// ---------------------------------------------------------------------------
async function phase2Static() {
  console.log("\nPhase 2 — Shell and dashboard");
  await check(2, "Shell, nav, dashboard, and charts exist", () => {
    for (const file of [
      "components/shell.tsx",
      "components/workspace-chrome.tsx",
      "components/sidebar-nav.tsx",
      "components/brand.tsx",
      "lib/nav.ts",
      "lib/dashboard.ts",
      "app/(app)/page.tsx",
      "app/(app)/layout.tsx",
    ]) {
      assert(exists(file), `Missing ${file}`);
    }
    const chrome = read("components/workspace-chrome.tsx") + read("components/brand.tsx") + read("lib/brand-name.ts");
    assert(chrome.includes("TikiTok Shop"), "Brand mark missing from shell");
    assert(chrome.includes("Not affiliated with TikTok"), "Public chrome must disclaim TikTok affiliation");
    assert(chrome.includes("logoutAction"), "Logout control missing");
    assert(chrome.includes("Open menu"), "Mobile menu control missing");
    const nav = read("lib/nav.ts");
    assert(nav.includes("isNavActive"), "Longest-prefix nav matching missing");
    assert(exists("public/products/p01.jpg") && exists("lib/product-image.ts"), "Dummy product images missing");
    assert(exists("public/catalog/DC-hot-selling-items-01.jpg"), "Catalog product photos missing");
    assert(exists("app/product-art/[sku]/route.ts") && exists("lib/product-art.ts") && exists("lib/product-photo.ts"), "Generated product art route missing");
    assert(read("lib/access.ts").includes("/product-art/"), "Product art must be a public path");
    const distribution = read("app/(app)/distribution/page.tsx") + read("lib/product-margin.ts") + read("lib/distribution-catalog.ts");
    assert(distribution.includes("Profit Margin"), "Distribution missing profit margin");
    assert(distribution.includes("overflow-x-auto"), "Distribution missing horizontal category row");
    assert(distribution.includes("STORE_CATEGORIES"), "Distribution must list the store categories");
    assert(distribution.includes("costFromSelling"), "Programmatic margin helper missing");
    assert(distribution.includes("MARGIN_MIN = 0.23") && distribution.includes("MARGIN_MAX = 0.25"), "Margin range missing");
  });
  await check(2, "Nav hides staff/admin items by role", () => {
    const nav = read("lib/nav.ts");
    assert(nav.includes("staffOnly") && nav.includes("adminOnly"), "Role flags missing");
    assert(nav.includes("visibleNav"), "visibleNav helper missing");
    assert(nav.includes("/users") && nav.includes("adminOnly"), "Team is not admin-only");
    assert(nav.includes("/settings") && nav.includes("adminOnly"), "Settings is not admin-only");
    assert(nav.includes("/merchants") && nav.includes("staffOnly"), "Merchants is not staff-only");
    assert(nav.includes("merchantOnly") && nav.includes("/distribution") && nav.includes("/withdraw"), "Store-only nav missing");
    assert(nav.includes("/support-desk") && nav.includes("Support Service"), "Support Service backend nav missing");
    assert(nav.includes('{ href: "/support-desk", label: "Support Service", icon: Headset, adminOnly: true }'), "Support Service must be Super Admin only in the main nav");
  });
  await check(2, "Dashboard is role-aware", () => {
    const page = read("app/(app)/page.tsx") + read("components/merchant-home.tsx");
    assert(page.includes("Store overview") && page.includes("Operations overview"), "Role titles missing");
    assert(page.includes("Available balance"), "Merchant wallet stats missing");
    assert(page.includes("Needs attention"), "Attention queue missing");
    const dash = read("lib/dashboard.ts");
    assert(dash.includes("availableBalance") && dash.includes("pendingApplications"), "Scoped dashboard queries missing");
  });
  await check(2, "Public signup and unique shop links exist", () => {
    for (const file of [
      "app/signup/page.tsx",
      "app/s/[slug]/page.tsx",
      "lib/shop-url.ts",
      "lib/shop-host.ts",
      "lib/slug.ts",
      "lib/actions/signup.ts",
    ]) {
      assert(exists(file), `Missing ${file}`);
    }
    const login = read("app/login/store/page.tsx") + read("app/login/page.tsx");
    assert(login.includes("/signup"), "Login is missing a Sign up path");
    const proxy = read("proxy.ts");
    assert(proxy.includes("/signup") && proxy.includes("/s/"), "proxy.ts must allow signup and shop cards");
    assert(read("lib/actions/signup.ts").includes("MERCHANT"), "Public signup must create a merchant user");
    assert(read("lib/actions/signup.ts").includes("allocateStoreCode"), "Signup must mint a Store ID");
    assert(read("lib/actions/signup.ts").includes("idFront"), "Signup must collect ID card front");
    assert(read("lib/actions/signup.ts").includes("idBack"), "Signup must collect ID card back");
    assert(read("lib/actions/signup.ts").includes("referralCode"), "Signup must accept an LLC code");
    assert(read("lib/actions/signup.ts").includes("isNumericLlcCode"), "Signup must reject non-numeric LLC codes");
    const signupPage =
      read("app/signup/page.tsx") + read("components/signup-form.tsx") + read("components/id-card-capture.tsx");
    assert(signupPage.includes("idFront") && signupPage.includes("idBack"), "Signup form missing ID uploads");
    assert(signupPage.includes("Gallery") && signupPage.includes("Camera"), "Signup ID capture missing gallery/camera");
    assert(signupPage.includes("referralCode"), "Signup form missing LLC code field");
    assert(signupPage.includes("LLC Code"), "Signup form must label LLC Code");
    assert(!signupPage.includes("LLC Code (optional)"), "LLC Code must not be labeled optional");
    assert(signupPage.includes('name="logo"'), "Signup form missing logo file picker");
    assert(signupPage.includes("replace(/\\D/g"), "Signup LLC Code must strip letters while typing");
    assert(!read("app/signup/page.tsx").includes("Super Admin"), "Signup page must not mention Super Admin");
    assert(!read("app/signup/page.tsx").includes("Normal Backend"), "Signup page must not mention Normal Backend");
    assert(!read("components/signup-form.tsx").includes("Super Admin"), "Signup form must not mention Super Admin");
    assert(!read("components/signup-form.tsx").includes("Normal Backend"), "Signup form must not mention Normal Backend");
    assert(!read("components/merchant-home.tsx").includes("Super Admin"), "Store dashboard must not mention Super Admin");
    assert(!read("components/merchant-home.tsx").includes("Normal Backend"), "Store dashboard must not mention Normal Backend");
    assert(exists("components/store-pending-review.tsx"), "Pending review screen missing");
    assert(read("components/store-pending-review.tsx").includes("Your store approval is in review"), "Pending review copy missing");
    assert(!read("components/store-pending-review.tsx").includes("Super Admin"), "Pending review must not mention Super Admin");
    assert(!read("components/store-pending-review.tsx").includes("Normal Backend"), "Pending review must not mention Normal Backend");
    assert(read("components/shell.tsx").includes('store?.status === "PENDING"'), "App shell must hide the dashboard while the store is pending");
    assert(read("lib/actions/signup.ts").includes('status: "PENDING"'), "Public signup must stay pending until approval");
    assert(read("lib/actions/signup.ts").includes("merchantApplication.create"), "Public signup must create an application for review");
    assert(read("lib/sync-distribution-catalog.ts").includes("cloneDistributionCatalogForMerchant"), "Approved stores need a catalog clone");
    assert(read("lib/actions/merchants.ts").includes("ensureMerchantCatalog"), "Approval must copy catalog products onto the store");
    assert(read("lib/referral.ts").includes("randomInt"), "LLC codes must be numeric");
    assert(!read("lib/referral.ts").includes("`REF"), "LLC codes must not use alphabetic prefixes");
    assert(read("prisma/seed.ts").includes('referralCode: "10000001"'), "Seed LLC code must be numeric");
    const start = read("scripts/start.mjs");
    assert(start.includes("rebuildIfStale") && start.includes("next"), "start script must rebuild stale .next");
    assert(start.includes("harbor-release.txt"), "start must rebuild when the release stamp changes");
    assert(read("components/role-login-form.tsx").includes("Release {RELEASE_LABEL}"), "Login must show the live release stamp");
    assert(!read("lib/actions/auth.ts").includes("error=setup"), "Login must not redirect to packed-demo setup");
    assert(read("lib/build-stamp.ts").includes("tikitok-independent-brand"), "Release label missing from build stamp");
    assert(read("lib/catalog-photo.ts").includes("CATALOG_PHOTO_VERSION"), "Catalog photo cache-bust missing");
    assert(exists("public/release.txt") && read("public/release.txt").includes("tikitok-independent-brand"), "public/release.txt missing live deploy stamp");
    assert(read("public/release.txt").includes("tiktok-shop-order-prices"), "public/release.txt dropped order-prices stamp");
    assert(read("public/release.txt").includes("tiktok-shop-catalog-c4"), "public/release.txt dropped catalog stamp");
    assert(exists("public/orders-live.txt") && read("public/orders-live.txt").includes("tiktok-shop-order-prices"), "orders-live stamp file missing");
    assert(read("lib/shop-url.ts").includes("shopAbsoluteUrl"), "Shop URL helper missing");
  });
  await check(2, "Login screens use the product name and hide demo passwords", () => {
    const login =
      read("app/login/page.tsx") +
      read("app/login/admin/page.tsx") +
      read("app/login/ops/page.tsx") +
      read("app/login/store/page.tsx") +
      read("app/login/support/page.tsx") +
      read("components/role-login-form.tsx") +
      read("lib/brand-name.ts");
    assert(login.includes("TikiTok Shop"), "Login missing product name");
    assert(login.includes("BRAND_NAME"), "Login must use the shared brand name");
    assert(read("app/login/support/page.tsx").includes("Support Desk Login"), "Support desk login missing");
    assert(!read("app/welcome/page.tsx").includes("/login/support"), "Welcome must not advertise Support Desk login");
    assert(!read("app/login/page.tsx").includes("/login/support"), "Public login index must not advertise Support Desk login");
    assert(!login.includes("HarborAdmin!2026"), "Demo admin password leaked on login");
    assert(!login.includes("HarborMerchant!2026"), "Demo merchant password leaked on login");
    assert(!login.includes("oscar.d@example.net"), "Demo admin email leaked on login");
  });
}

async function phase2Database(prisma) {
  await check(2, "Notifications exist for staff and the demo merchant", async () => {
    const admin = await prisma.user.findUnique({ where: { email: "oscar.d@example.net" } });
    const merchant = await prisma.user.findUnique({ where: { email: "iris.p@example.org" } });
    const staffCount = await prisma.notification.count({ where: { userId: admin.id } });
    const merchantCount = await prisma.notification.count({ where: { userId: merchant.id } });
    assert(staffCount >= 2, `Admin notifications: ${staffCount}`);
    assert(merchantCount >= 1, "Merchant has no notifications");
  });
  await check(2, "Nav active matching prefers the longest href", () => {
    const hrefs = ["/", "/merchants", "/merchants/applications", "/finance", "/finance/payouts"];
    assert(isNavActiveCheck("/merchants/applications", "/merchants/applications", hrefs), "child not active");
    assert(!isNavActiveCheck("/merchants/applications", "/merchants", hrefs), "parent stayed active on nested route");
    assert(isNavActiveCheck("/merchants/abc", "/merchants", hrefs), "merchant detail should activate Merchants");
    assert(!isNavActiveCheck("/finance/payouts", "/finance", hrefs), "Ledger stayed active on Payouts");
    assert(isNavActiveCheck("/", "/", hrefs), "dashboard not active");
    assert(!isNavActiveCheck("/orders", "/", hrefs), "dashboard active on orders");
  });
}

// ---------------------------------------------------------------------------
// Phase 3
// ---------------------------------------------------------------------------
async function phase3Static() {
  console.log("\nPhase 3 — Orders, shipping, refunds");
  await check(3, "Order, shipping, and refund routes exist", () => {
    for (const file of [
      "app/(app)/orders/page.tsx",
      "app/(app)/orders/[id]/page.tsx",
      "app/(app)/shipping/page.tsx",
      "app/(app)/refunds/page.tsx",
      "lib/actions/orders.ts",
      "lib/actions/refunds.ts",
      "lib/order-flow.ts",
    ]) {
      assert(exists(file), `Missing ${file}`);
    }
  });
  await check(3, "Status machine matches the documented lifecycle", () => {
    const flow = read("lib/order-flow.ts");
    assert(flow.includes('PENDING_PAYMENT: ["PAID", "CANCELLED"]'), "Unpaid transitions wrong");
    assert(flow.includes('PAID: ["PROCESSING", "CANCELLED"]'), "Paid transitions wrong");
    assert(flow.includes('PROCESSING: ["CANCELLED"]'), "Processing must not skip tracking");
    assert(flow.includes('SHIPPED: ["DELIVERED"]'), "Shipped transitions wrong");
    assert(flow.includes('DELIVERED: ["COMPLETED"]'), "Delivered transitions wrong");
    const actions = read("lib/actions/orders.ts");
    assert(actions.includes("canChangeOrderStatus"), "Actions do not use shared transitions");
    assert(actions.includes("Cancelled after payment"), "Cancel does not reverse pending profit");
    assert(actions.includes('status: "DELIVERED"'), "Delivered does not update shipments");
    assert(read("lib/actions/refunds.ts").includes("restock"), "Refund restock missing");
    assert(read("app/(app)/shipping/page.tsx").includes("Ready to ship"), "Ready-to-ship queue missing");
  });
  await check(3, "Illegal status jumps are rejected", () => {
    assert(!canChangeOrderCheck("PENDING_PAYMENT", "SHIPPED"), "Unpaid cannot jump to shipped");
    assert(!canChangeOrderCheck("PENDING_PAYMENT", "COMPLETED"), "Unpaid cannot complete");
    assert(!canChangeOrderCheck("SHIPPED", "CANCELLED"), "Shipped cannot cancel");
    assert(!canChangeOrderCheck("COMPLETED", "PAID"), "Completed cannot go back to paid");
    assert(!canChangeOrderCheck("PROCESSING", "SHIPPED", "button"), "Shipped requires tracking");
    assert(canChangeOrderCheck("PAID", "SHIPPED", "ship"), "Paid should be shippable with tracking");
    assert(canChangeOrderCheck("PROCESSING", "SHIPPED", "ship"), "Processing should be shippable");
    assert(canChangeOrderCheck("DELIVERED", "COMPLETED"), "Delivered should complete");
    assert(!canOpenRefundCheck("PENDING_PAYMENT") && !canOpenRefundCheck("CANCELLED"), "Unpaid/cancelled refunds");
    assert(canOpenRefundCheck("PAID") && canOpenRefundCheck("COMPLETED"), "Paid orders should allow refunds");
  });
}

async function phase3Database(prisma) {
  await check(3, "Seed covers every order status, carriers, shipments, refunds", async () => {
    const statuses = [
      "PENDING_PAYMENT",
      "PAID",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ];
    for (const status of statuses) {
      const count = await prisma.order.count({ where: { status } });
      assert(count > 0, `No ${status} orders in seed`);
    }
    const carriers = await prisma.carrier.count();
    assert(carriers >= 3, `Expected 3 carriers, found ${carriers}`);
    const shipments = await prisma.shipment.count();
    assert(shipments > 0, "No shipments seeded");
    const refunds = await prisma.refund.count();
    assert(refunds > 0, "No refunds seeded");
    const pendingRefunds = await prisma.refund.count({ where: { status: "PENDING" } });
    assert(pendingRefunds > 0, "No pending refunds for ops to review");
  });
  await check(3, "Pickup demo orders are unpaid until Click to Pick Up", async () => {
    const moved = await prisma.order.updateMany({
      where: {
        pickedAt: null,
        OR: [
          { status: "PAID", orderNumber: { startsWith: "HB-2026-PICKUP-" } },
          { status: "PROCESSING", notes: "Placed by super admin" },
        ],
      },
      data: { status: "PENDING_PAYMENT" },
    });
    void moved;
    const unpaidPickup = await prisma.order.count({
      where: { orderNumber: { startsWith: "HB-2026-PICKUP-" }, status: "PENDING_PAYMENT", pickedAt: null },
    });
    assert(unpaidPickup >= 2, "Pickup demo orders are not waiting unpaid");
    assert(read("prisma/seed.ts").includes("HB-2026-PICKUP-"), "Pickup demo seed missing");
    assert(read("prisma/seed.ts").includes("status: OrderStatus.PENDING_PAYMENT"), "Pickup demo seed must start unpaid");
  });

  await check(3, "Isolated order lifecycle: pay → ship → complete moves balances", async () => {
    const plan = await prisma.plan.findFirst({ orderBy: { monthlyFee: "asc" } });
    const category = await prisma.category.findFirst();
    assert(plan && category, "Need a plan and category");

    const merchant = await prisma.merchant.create({
      data: {
        name: "VERIFY Lifecycle Store",
        slug: `verify-lifecycle-${Date.now()}`,
        legalName: "VERIFY Lifecycle LLC",
        email: "verify-lifecycle@example.test",
        phone: "+1-555-0001",
        country: "US",
        city: "Test",
        address: "1 Verify Way",
        status: "ACTIVE",
        planId: plan.id,
        availableBalance: 0,
        pendingBalance: 0,
        bankName: "Verify Bank",
        bankAccountLast4: "0001",
      },
    });
    const customer = await prisma.customer.create({
      data: {
        name: "VERIFY Buyer",
        email: `verify.buyer.${Date.now()}@example.test`,
        phone: "+1-555-0002",
        address: "2 Verify Way",
        city: "Test",
        country: "US",
      },
    });
    const product = await prisma.product.create({
      data: {
        merchantId: merchant.id,
        categoryId: category.id,
        title: "VERIFY Widget",
        sku: `VERIFY-SKU-${Date.now()}`,
        description: "Phase 3 lifecycle fixture",
        price: 40,
        cost: 10,
        stock: 5,
        status: "ACTIVE",
      },
    });
    const profit = 25;
    const order = await prisma.order.create({
      data: {
        orderNumber: `VERIFY-ORD-${Date.now()}`,
        merchantId: merchant.id,
        customerId: customer.id,
        status: "PENDING_PAYMENT",
        subtotal: 40,
        shippingFee: 0,
        tax: 0,
        total: 40,
        cost: 10,
        profit,
        platformFee: 5,
        items: {
          create: {
            productId: product.id,
            title: product.title,
            sku: product.sku,
            quantity: 1,
            price: 40,
            cost: 10,
          },
        },
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
      await tx.merchant.update({
        where: { id: merchant.id },
        data: { pendingBalance: { increment: profit } },
      });
      await tx.ledgerEntry.create({
        data: {
          merchantId: merchant.id,
          type: "SALE",
          amount: profit,
          reference: order.orderNumber,
          note: "VERIFY pending settlement",
        },
      });
    });
    let fresh = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    assert(fresh.pendingBalance === profit, `Pending after pay was ${fresh.pendingBalance}`);

    const carrier = await prisma.carrier.findFirst();
    await prisma.$transaction([
      prisma.shipment.create({
        data: {
          orderId: order.id,
          carrierId: carrier.id,
          trackingNumber: "VERIFY-TRACK-1",
          status: "IN_TRANSIT",
          shippedAt: new Date(),
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { status: "SHIPPED", shippedAt: new Date() },
      }),
    ]);
    const shipped = await prisma.order.findUnique({
      where: { id: order.id },
      include: { shipments: true },
    });
    assert(shipped.status === "SHIPPED", `Ship status ${shipped.status}`);
    assert(shipped.shipments[0]?.trackingNumber === "VERIFY-TRACK-1", "Tracking not stored");

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.merchant.update({
        where: { id: merchant.id },
        data: {
          pendingBalance: { decrement: profit },
          availableBalance: { increment: profit },
        },
      });
    });
    fresh = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    assert(fresh.pendingBalance === 0, `Pending after complete was ${fresh.pendingBalance}`);
    assert(fresh.availableBalance === profit, `Available after complete was ${fresh.availableBalance}`);

    const refund = await prisma.refund.create({
      data: {
        refundNumber: `VERIFY-RF-${Date.now()}`,
        orderId: order.id,
        type: "RETURN_AND_REFUND",
        reason: "VERIFY restock",
        amount: 10,
        restock: true,
        status: "PENDING",
      },
    });
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: { status: "COMPLETED", resolvedAt: new Date() },
      });
      await tx.merchant.update({
        where: { id: merchant.id },
        data: { availableBalance: { decrement: 10 } },
      });
      await tx.ledgerEntry.create({
        data: {
          merchantId: merchant.id,
          type: "REFUND",
          amount: -10,
          reference: refund.refundNumber,
          note: "VERIFY refund",
        },
      });
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { increment: 1 } },
      });
    });
    const restocked = await prisma.product.findUnique({ where: { id: product.id } });
    assert(restocked.stock === 6, `Stock after restock was ${restocked.stock}`);
    fresh = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    assert(fresh.availableBalance === 15, `Available after refund was ${fresh.availableBalance}`);

    await prisma.refund.deleteMany({ where: { orderId: order.id } });
    await prisma.shipment.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.ledgerEntry.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  });

  await check(3, "Cancelling a paid order reverses pending profit", async () => {
    const plan = await prisma.plan.findFirst();
    const merchant = await prisma.merchant.create({
      data: {
        name: "VERIFY Cancel Store",
        slug: `verify-cancel-${Date.now()}`,
        legalName: "VERIFY Cancel LLC",
        email: "verify-cancel@example.test",
        phone: "+1-555-0008",
        country: "US",
        city: "Test",
        address: "8 Verify Way",
        status: "ACTIVE",
        planId: plan.id,
        availableBalance: 0,
        pendingBalance: 40,
      },
    });
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { pendingBalance: { decrement: 40 } },
    });
    const reversed = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    assert(reversed.pendingBalance === 0, `Pending after cancel reverse was ${reversed.pendingBalance}`);
    await prisma.merchant.delete({ where: { id: merchant.id } });
  });
}

// ---------------------------------------------------------------------------
// Phase 4
// ---------------------------------------------------------------------------
async function phase4Static() {
  console.log("\nPhase 4 — Merchants, applications, plans");
  await check(4, "Merchant, application, and plan routes exist", () => {
    for (const file of [
      "app/(app)/merchants/page.tsx",
      "app/(app)/merchants/[id]/page.tsx",
      "app/(app)/merchants/applications/page.tsx",
      "app/(app)/merchants/plans/page.tsx",
      "lib/actions/merchants.ts",
    ]) {
      assert(exists(file), `Missing ${file}`);
    }
    const pages = [
      "app/(app)/merchants/page.tsx",
      "app/(app)/merchants/[id]/page.tsx",
      "app/(app)/merchants/applications/page.tsx",
      "app/(app)/merchants/plans/page.tsx",
    ];
    for (const file of pages) {
      assert(read(file).includes("isStaff"), `${file} is not staff-gated`);
    }
    const actions = read("lib/actions/merchants.ts");
    assert(actions.includes('decision !== "APPROVED"'), "Approve must be explicit");
    assert(actions.includes("createApplication"), "Inbound application intake missing");
    assert(actions.includes("Assigned plan"), "Plan assignment is not audited");
    assert(read("app/(app)/merchants/applications/page.tsx").includes("Log inbound seller"), "Intake form missing");
    assert(read("app/(app)/merchants/plans/page.tsx").includes("merchants"), "Plans do not list stores");
  });
}

async function phase4Database(prisma) {
  await check(4, "Seed has active, pending, suspended merchants and plans", async () => {
    for (const status of ["ACTIVE", "PENDING", "SUSPENDED"]) {
      const count = await prisma.merchant.count({ where: { status } });
      assert(count > 0, `No ${status} merchants`);
    }
    const plans = await prisma.plan.findMany();
    assert(plans.length >= 3, `Expected 3 plans, found ${plans.length}`);
    for (const name of ["Starter", "Growth", "Scale"]) {
      assert(plans.some((plan) => plan.name === name), `Missing plan ${name}`);
    }
    assert(
      plans.every((plan) => plan.monthlyFee > 0 && plan.commissionRate > 0),
      "Plans need a monthly fee and commission",
    );
    const pendingApps = await prisma.merchantApplication.count({ where: { status: "PENDING" } });
    assert(pendingApps > 0, "No pending applications");
  });

  await check(4, "Approving an application creates an ACTIVE merchant", async () => {
    const starter = await prisma.plan.findFirst({ orderBy: { monthlyFee: "asc" } });
    const application = await prisma.merchantApplication.create({
      data: {
        businessName: "VERIFY Applicant Co",
        contactName: "Verify Contact",
        email: `verify.app.${Date.now()}@example.test`,
        phone: "+1-555-0003",
        country: "US",
        category: "Test",
        notes: "Phase 4 fixture",
        status: "PENDING",
      },
    });
    const merchant = await prisma.merchant.create({
      data: {
        name: application.businessName,
        slug: `verify-app-${Date.now()}`,
        legalName: application.businessName,
        email: application.email,
        phone: application.phone,
        country: application.country,
        city: "",
        address: "",
        status: "ACTIVE",
        planId: starter.id,
      },
    });
    await prisma.merchantApplication.update({
      where: { id: application.id },
      data: { status: "APPROVED", merchantId: merchant.id, reviewedAt: new Date() },
    });
    const updated = await prisma.merchantApplication.findUnique({ where: { id: application.id } });
    assert(updated.status === "APPROVED", "Application was not approved");
    assert(updated.merchantId === merchant.id, "Application not linked to merchant");
    const created = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    assert(created.status === "ACTIVE" && created.planId === starter.id, "Approved store not on Starter/ACTIVE");

    await prisma.merchantApplication.delete({ where: { id: application.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  });

  await check(4, "Rejecting an application does not create a merchant", async () => {
    const before = await prisma.merchant.count();
    const application = await prisma.merchantApplication.create({
      data: {
        businessName: "VERIFY Reject Co",
        contactName: "Verify Reject",
        email: `verify.reject.${Date.now()}@example.test`,
        phone: "+1-555-0009",
        country: "US",
        category: "Test",
        notes: "Should stay rejected",
        status: "PENDING",
      },
    });
    await prisma.merchantApplication.update({
      where: { id: application.id },
      data: { status: "REJECTED", reviewNote: "Not a fit", reviewedAt: new Date() },
    });
    const updated = await prisma.merchantApplication.findUnique({ where: { id: application.id } });
    assert(updated.status === "REJECTED", "Application was not rejected");
    assert(!updated.merchantId, "Rejected application linked a merchant");
    const after = await prisma.merchant.count();
    assert(after === before, "Reject created a merchant");
    await prisma.merchantApplication.delete({ where: { id: application.id } });
  });
}

// ---------------------------------------------------------------------------
// Phase 5
// ---------------------------------------------------------------------------
async function phase5Static() {
  console.log("\nPhase 5 — Catalog, customers, reviews");
  await check(5, "Catalog and customer routes exist", () => {
    for (const file of [
      "app/(app)/products/page.tsx",
      "app/(app)/products/[id]/page.tsx",
      "app/(app)/categories/page.tsx",
      "app/(app)/reviews/page.tsx",
      "app/(app)/customers/page.tsx",
      "app/(app)/customers/[id]/page.tsx",
      "lib/actions/catalog.ts",
    ]) {
      assert(exists(file), `Missing ${file}`);
    }
    const save = read("lib/actions/catalog.ts");
    assert(save.includes("catalogMerchantId"), "Merchant product scope missing");
    assert(save.includes("maxProducts"), "Plan catalog cap is not enforced");
    assert(save.includes("sku"), "SKU uniqueness missing");
    assert(read("lib/scope.ts").includes("catalogMerchantId"), "catalogMerchantId helper missing");
    assert(read("app/(app)/categories/page.tsx").includes("isStaff"), "Categories not staff-gated");
    assert(read("app/(app)/customers/page.tsx").includes("isStaff"), "Customers not staff-gated");
    assert(read("app/(app)/products/page.tsx").includes("LOW_STOCK"), "Low-stock catalog filter missing");
    const taxonomy = read("lib/store-categories.ts");
    for (const name of [
      "Hot Selling Items",
      "Computer accessories",
      "Home cabinets",
      "Health Products",
      "Men's clothing",
      "Women's clothing",
      "Snacks and desserts",
      "Mobile accessories",
      "Children's toys",
      "Beverages",
      "Office supplies",
      "Digital products",
      "Beauty and skincare",
      "Mother and baby products",
      "Jewelry and watches",
      "Luxury goods",
      "Children's clothing",
      "Men's bags",
      "Women's bags",
      "Fitness Equipment",
    ]) {
      assert(taxonomy.includes(name), `Missing category ${name}`);
    }
  });
}

async function phase5Database(prisma) {
  await check(5, "Seed has products, categories, reviews, customers", async () => {
    const products = await prisma.product.count();
    const categories = await prisma.category.count();
    const reviews = await prisma.review.count();
    const customers = await prisma.customer.count();
    assert(products >= 500, `Only ${products} products`);
    assert(categories >= 20, `Only ${categories} categories`);
    assert(reviews >= 5, `Only ${reviews} reviews`);
    assert(customers >= 8, `Only ${customers} customers`);
  });
  await check(5, "Northline catalog has 25+ products per store category with 23-25% margin", async () => {
    const names = [
      "Hot Selling Items",
      "Computer accessories",
      "Home cabinets",
      "Health Products",
      "Men's clothing",
      "Women's clothing",
      "Snacks and desserts",
      "Mobile accessories",
      "Children's toys",
      "Beverages",
      "Office supplies",
      "Digital products",
      "Beauty and skincare",
      "Mother and baby products",
      "Jewelry and watches",
      "Luxury goods",
      "Children's clothing",
      "Men's bags",
      "Women's bags",
      "Fitness Equipment",
    ];
    const northline = await prisma.merchant.findUnique({ where: { slug: "northline-outfitters" } });
    assert(northline, "Northline store missing");
    const products = await prisma.product.findMany({
      where: { merchantId: northline.id },
      include: { category: true },
    });
    assert(products.length >= 500, `Northline has ${products.length} products`);
    const titles = new Set();
    const images = new Set();
    const byCat = {};
    for (const product of products) {
      assert(product.categoryId, `${product.title} missing category`);
      assert(product.price >= 10 && product.price <= 5000, `${product.title} price ${product.price}`);
      assert(product.price - product.cost > 0, `${product.title} has no profit`);
      const margin = (product.price - product.cost) / product.price;
      assert(margin >= 0.229 && margin <= 0.251, `${product.title} margin ${margin}`);
      assert(product.image.includes("/c4/") || product.image.includes("/catalog/") || product.image.includes("/product-art/"), `${product.title} missing catalog image`);
      assert(!titles.has(product.title), `Duplicate title ${product.title}`);
      assert(!images.has(product.image), `Duplicate image ${product.image}`);
      titles.add(product.title);
      images.add(product.image);
      byCat[product.category.name] = (byCat[product.category.name] ?? 0) + 1;
    }
    for (const name of names) {
      assert((byCat[name] ?? 0) >= 25, `${name} has ${byCat[name] ?? 0} products`);
    }
    const growth = await prisma.plan.findFirst({ where: { name: "Growth" } });
    assert(growth && growth.maxProducts >= 500, "Growth plan cannot hold the store catalog");
  });
  await check(5, "Merchant scoping helper forces store id", () => {
    const scope = read("lib/scope.ts");
    assert(scope.includes("merchantId: session.merchantId"), "merchantScope does not pin store id");
    assert(scope.includes("canAccessMerchant"), "canAccessMerchant missing");
    assert(scope.includes("catalogMerchantId"), "catalogMerchantId missing");
  });
  await check(5, "Plan product cap blocks extra SKUs", async () => {
    const plan = await prisma.plan.create({
      data: {
        name: "VERIFY Cap",
        description: "One SKU only",
        monthlyFee: 1,
        commissionRate: 0.1,
        maxProducts: 1,
        features: "[]",
      },
    });
    const merchant = await prisma.merchant.create({
      data: {
        name: "VERIFY Cap Store",
        slug: `verify-cap-${Date.now()}`,
        legalName: "VERIFY Cap LLC",
        email: "verify-cap@example.test",
        phone: "+1-555-0010",
        country: "US",
        city: "Test",
        address: "10 Verify Way",
        status: "ACTIVE",
        planId: plan.id,
      },
    });
    const category = await prisma.category.findFirst();
    await prisma.product.create({
      data: {
        merchantId: merchant.id,
        categoryId: category.id,
        title: "VERIFY Only SKU",
        sku: `VERIFY-CAP-${Date.now()}`,
        description: "Cap fixture",
        price: 10,
        cost: 2,
        stock: 3,
        status: "ACTIVE",
      },
    });
    const counted = await prisma.product.count({ where: { merchantId: merchant.id } });
    const loaded = await prisma.merchant.findUnique({
      where: { id: merchant.id },
      include: { plan: true, _count: { select: { products: true } } },
    });
    assert(counted >= loaded.plan.maxProducts, "Cap fixture should be at max");
    assert(loaded._count.products >= loaded.plan.maxProducts, "Count under cap");
    await prisma.product.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
    await prisma.plan.delete({ where: { id: plan.id } });
  });
  await check(5, "New stores default to rating 5.0 and credit score 100", async () => {
    const plan = await prisma.plan.findFirst({ orderBy: { monthlyFee: "asc" } });
    assert(plan, "Need a plan");
    const merchant = await prisma.merchant.create({
      data: {
        name: "VERIFY Score Store",
        slug: `verify-score-${Date.now()}`,
        legalName: "VERIFY Score LLC",
        email: "verify-score@example.test",
        phone: "+1-555-0011",
        country: "US",
        city: "Test",
        address: "11 Verify Way",
        status: "ACTIVE",
        planId: plan.id,
      },
    });
    const loaded = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    assert(loaded, "Score fixture missing");
    assert(Number(loaded.rating) === 5.0, `Expected rating 5.0, got ${loaded.rating}`);
    assert(loaded.creditScore === 100, `Expected credit 100, got ${loaded.creditScore}`);
    await prisma.merchant.delete({ where: { id: merchant.id } });
  });
}

// ---------------------------------------------------------------------------
// Phase 6
// ---------------------------------------------------------------------------
async function phase6Static() {
  console.log("\nPhase 6 — Finance and workspace");
  await check(6, "Finance and workspace routes exist", () => {
    for (const file of [
      "app/(app)/finance/page.tsx",
      "app/(app)/finance/payouts/page.tsx",
      "app/(app)/notifications/page.tsx",
      "app/(app)/users/page.tsx",
      "app/(app)/profile/page.tsx",
      "app/(app)/account/page.tsx",
      "app/(app)/service/page.tsx",
      "app/(app)/distribution/page.tsx",
      "app/(app)/withdraw/page.tsx",
      "app/(app)/recharge/page.tsx",
      "app/(app)/settings/page.tsx",
      "lib/actions/payouts.ts",
      "lib/actions/users.ts",
      "lib/actions/pickup.ts",
      "lib/actions/support.ts",
      "lib/actions/account.ts",
      "lib/service-bot.ts",
      "lib/service-session.ts",
      "lib/support-media.ts",
      "app/(app)/service/media/[messageId]/route.ts",
    ]) {
      assert(exists(file), `Missing ${file}`);
    }
    assert(read("app/(app)/users/page.tsx").includes("canManageTeam"), "Users not admin-gated");
    assert(read("lib/actions/users.ts").includes("createStoreUser"), "Store login helper missing");
    assert(read("app/(app)/merchants/[id]/page.tsx").includes("createStoreUser"), "Merchant detail cannot create a store login");
    assert(read("app/(app)/settings/page.tsx").includes("SUPER_ADMIN"), "Settings not admin-gated");
    const payouts = read("lib/actions/payouts.ts");
    assert(payouts.includes("availableBalance"), "Payout does not touch available balance");
    assert(payouts.includes("error=balance"), "Overdraw guard missing");
    assert(payouts.includes("canDecidePayout"), "Payout status machine missing");
    assert(payouts.includes("catalogMerchantId"), "Payout merchant scope missing");
    const pickup = read("lib/actions/pickup.ts");
    assert(pickup.includes("paymentPassword"), "Pickup payment password missing");
    assert(pickup.includes("Insufficient Balance"), "Pickup balance error missing");
    assert(pickup.includes("updateMany"), "Pickup concurrency lock missing");
    assert(pickup.includes("$transaction"), "Pickup is not atomic");
    assert(pickup.includes('status: "PENDING_PAYMENT"'), "Pickup must claim unpaid orders");
    assert(pickup.includes('status: "PAID"'), "Pickup must mark the order Paid");
    assert(!pickup.includes('status: "PROCESSING"'), "Pickup must not jump to Processing");
    const staffOrder = read("lib/actions/admin.ts");
    assert(staffOrder.includes('status: "PENDING_PAYMENT"'), "Order Sender must create unpaid orders");
    assert(staffOrder.includes("updatedAt: now"), "Order Sender must stamp updatedAt so new orders sort first");
    assert(exists("app/api/orders/live/route.ts"), "Store orders live API missing");
    assert(exists("app/ol1/route.ts"), "Hostinger-uncached orders live path missing");
    assert(exists("components/orders-live-board.tsx"), "Store orders live board missing");
    assert(exists("lib/orders-query.ts"), "Store orders query helper missing");
    const liveBoard = read("components/orders-live-board.tsx");
    assert(liveBoard.includes("/ol1"), "Orders board does not poll the uncached live path");
    assert(liveBoard.includes("PENDING_PAYMENT"), "Orders board must show unpaid pickup cards");
    assert(liveBoard.includes("Cost Price") && liveBoard.includes("Total Price") && liveBoard.includes("Profit Amount"), "Store orders missing cost/total/profit");
    assert(read("lib/order-economics.ts").includes("total - cost"), "Profit must be total minus cost");
    assert(read("lib/actions/admin.ts").includes("orderProfitAmount"), "Order Sender must store total-minus-cost profit");
    assert(read("lib/orders-query.ts").includes("orderProfitAmount"), "Live order cards must recompute profit");
    assert(read("lib/staff-display.ts").includes("ID No 004"), "Super Admin must display as ID No 004");
    assert(read("lib/auth.ts").includes("displayStaffName"), "Sessions must remap Super Admin to ID No 004");
    assert(read("components/support-desk-chrome.tsx").includes("displayStaffName"), "Support Desk must show the staff ID not the old name");
    const cookiePackProfit = Math.round((19.79 - 9.24) * 100) / 100;
    assert(cookiePackProfit === 10.55, "Almond Cookie Pack profit must be total minus cost");
    assert(read("lib/ensure-db.ts").includes("WHERE paidAt IS NULL"), "Profit backfill must not rewrite settled orders");
    assert(read("app/(app)/orders/page.tsx").includes("OrdersLiveBoard"), "Orders page missing live board");
    assert(read("lib/labels.ts").includes('PENDING_PAYMENT: "Unpaid"'), "Unpaid label missing");
    assert(read("lib/dashboard.ts").includes('status: "PENDING_PAYMENT"'), "Ready-to-pick-up must count unpaid orders");
    assert(read("lib/orders-query.ts").includes('updatedAt: "desc"'), "Orders must sort newest first");
    assert(read("next.config.js").includes("/ol1"), "Orders live ol1 cache header missing");
    const account = read("lib/actions/account.ts");
    assert(account.includes("paymentPasswordHash") && account.includes("bcrypt.hash"), "Payment password is not hashed");
    assert(account.includes("passwordHash"), "Login password change missing");
    assert(exists("lib/payout-flow.ts"), "payout-flow missing");
    assert(!canDecidePayoutCheck("PENDING", "PAID"), "Pending payout cannot skip to paid");
    assert(!canDecidePayoutCheck("PAID", "PAID"), "Paid payout cannot be paid twice");
    assert(canDecidePayoutCheck("PENDING", "APPROVED"), "Pending should approve");
    assert(canDecidePayoutCheck("APPROVED", "PAID"), "Approved should mark paid");
    assert(read("lib/actions/users.ts").includes("password.length < 8"), "Team password rule missing");
    for (const file of [
      "app/(app)/admin/layout.tsx",
      "app/(app)/admin/place-order/page.tsx",
      "app/(app)/admin/funds/page.tsx",
      "app/(app)/admin/releases/page.tsx",
      "app/(app)/admin/users/page.tsx",
      "app/(app)/admin/broadcast/page.tsx",
      "app/(app)/admin/stores/page.tsx",
      "app/(app)/admin/stores/[id]/page.tsx",
      "app/(app)/admin/support/page.tsx",
      "app/(app)/admin/support/[merchantId]/page.tsx",
      "app/support-desk/page.tsx",
      "app/support-desk/[merchantId]/page.tsx",
      "app/login/support/page.tsx",
      "components/support-backend-inbox.tsx",
      "components/support-store-details.tsx",
      "components/support-desk-chrome.tsx",
      "components/support-desk-sidebar.tsx",
      "components/support-live-chat.tsx",
      "lib/support-live.ts",
      "lib/support-deliver.ts",
      "app/api/support/live/route.ts",
      "lib/support-inbox.ts",
      "lib/support-paths.ts",
      "components/order-sender-board.tsx",
      "lib/order-sender.ts",
      "app/api/admin/stores/search/route.ts",
      "app/api/orders/live/route.ts",
      "app/ol1/route.ts",
      "components/orders-live-board.tsx",
      "lib/orders-live.ts",
      "lib/orders-query.ts",
      "lib/actions/admin.ts",
      "lib/process-releases.ts",
    ]) {
      assert(exists(file), `Missing ${file}`);
    }
    const admin = read("lib/actions/admin.ts");
    assert((admin.match(/requireSuperAdmin/g) || []).length >= 6, "Admin actions must require super admin");
    assert(admin.includes("placeStaffOrder") && admin.includes("addStoreFunds"), "Staff order or funds helper missing");
    assert(admin.includes("schedulePaymentRelease") && admin.includes("broadcastToStores"), "Release or broadcast helper missing");
    assert(admin.includes("createOpsUser"), "Ops user helper missing");
    assert(admin.includes("deleteOpsUser"), "Ops user delete helper missing");
    assert(admin.includes("snapshotOpsUsers"), "Ops users must be snapshotted after create/delete");
    assert(read("lib/ops-users-store.ts").includes("restoreOpsUsers"), "Ops user restore missing");
    assert(read("lib/ensure-db.ts").includes("restoreOpsUsers"), "Boot must restore Normal Backend users");
    assert(read("scripts/copy-demo-db.mjs").includes("persistentDataDirs"), "Live SQLite must prefer a persistent folder");
    assert(read("scripts/copy-demo-db.mjs").includes("homedir"), "Live SQLite must survive Hostinger deploys");
    assert(read("app/(app)/admin/users/page.tsx").includes("DeleteOpsUserButton"), "Normal Backend users need a delete action");
    assert(read("app/(app)/admin/users/page.tsx").includes("until you delete them"), "Users page must say logins persist");
    assert(admin.includes("updateStoreScore") && admin.includes("parseStoreRating"), "Store score editor missing");
    assert(read("lib/store-score.ts").includes("STORE_RATING_MAX = 5"), "Store rating limit missing");
    assert(read("lib/store-score.ts").includes("STORE_CREDIT_MAX = 100"), "Store credit limit missing");
    assert(read("lib/store-score.ts").includes("value < STORE_RATING_MIN"), "Negative rating must be rejected");
    assert(read("prisma/schema.prisma").includes("creditScore"), "Merchant creditScore column missing");
    assert(read("prisma/schema.prisma").includes("@default(5.0)"), "Store rating default must be 5.0");
    assert(read("components/merchant-home.tsx").includes("Store Rating") && read("components/merchant-home.tsx").includes("Credit Score"), "Store dashboard scores missing");
    assert(read("app/(app)/admin/stores/[id]/page.tsx").includes("StoreScoreForm"), "Super Admin store score form missing");
    assert(!read("lib/actions/account.ts").includes("creditScore"), "Store users must not edit credit score");
    assert(!read("lib/actions/account.ts").includes("rating"), "Store users must not edit store rating");
    assert(!read("app/(app)/account/page.tsx").includes("Current payment password"), "Store profile still asks for current payment password");
    assert(!read("app/(app)/account/page.tsx").includes("Current login password"), "Store profile still asks for current login password");
    assert(!read("lib/actions/account.ts").includes("currentPassword"), "Store password change still checks the current password");
    const serviceSession = read("lib/service-session.ts") + read("lib/service-bot.ts") + read("lib/actions/support.ts") + read("lib/support-media.ts");
    assert(serviceSession.includes("SERVICE_SESSION_MS"), "1-hour service session missing");
    assert(serviceSession.includes("Welcome to our Support Service"), "Service welcome copy missing");
    assert(serviceSession.includes("welcomeSentAt"), "Welcome-once flag missing");
    assert(serviceSession.includes("expireStaleSupportSessions"), "Server-side session expiry missing");
    assert(serviceSession.includes("saveSupportUpload"), "Support upload helper missing");
    assert(read("lib/support-media.ts").includes("SUPPORT_UPLOAD_ROOT"), "Private upload root missing");
    assert(read("components/support-desk-sidebar.tsx").includes("Active Service Sessions"), "Agent active session list missing");
    assert(read("app/(app)/service/page.tsx").includes("storeMode"), "Store Service must use the no-timer composer");
    assert(!read("app/(app)/service/page.tsx").includes("ServiceTimer"), "Store Service must not show the countdown");
    assert(read("app/support-desk/[merchantId]/page.tsx").includes("ServiceTimer"), "Support backend chat missing timer");
    assert(read("app/support-desk/[merchantId]/page.tsx").includes("SupportStoreDetails"), "Support backend chat missing store details");
    assert(read("app/login/support/page.tsx").includes("loginSupportAction"), "Support desk login action missing");
    assert(read("app/support-desk/layout.tsx").includes("requireSupportDesk"), "Support desk is not staff-gated");
    assert(read("components/support-live-chat.tsx").includes("/api/support/live"), "Live support poll missing");
    assert(read("components/support-desk-sidebar.tsx").includes("/api/support/live?inbox=1"), "Support desk inbox poll missing");
    assert(read("components/service-composer.tsx").includes("is typing") || read("components/support-live-chat.tsx").includes("is typing"), "Typing indicator missing");
    assert(read("app/api/support/live/route.ts").includes("setSupportTyping"), "Typing ping missing");
    assert(read("components/service-composer.tsx").includes("Upload Image/Video"), "Service media picker missing");
    assert(read("lib/process-releases.ts").includes('status: "SCHEDULED"'), "Release job must only pick scheduled rows");
    assert(read("lib/auth.ts").includes("requireSuperAdmin"), "requireSuperAdmin missing");
    assert(read("app/(app)/admin/layout.tsx").includes("requireSuperAdmin"), "Admin layout is not gated");
    assert(read("lib/nav.ts").includes("/admin/place-order") && read("lib/nav.ts").includes("adminOnly"), "Super admin nav missing");
    assert(read("lib/nav.ts").includes("Order Sender"), "Order Sender nav label missing");
    const listing = read("prisma/schema.prisma") + read("app/(app)/distribution/page.tsx") + read("lib/actions/catalog.ts");
    assert(listing.includes("ProductListingStatus") && listing.includes("ON_SHELF") && listing.includes("LISTED"), "Listing status missing");
    assert(listing.includes("setProductListingStatus"), "Listing status action missing");
    assert(read("app/(app)/admin/place-order/page.tsx").includes("Search Store") || read("components/order-sender-board.tsx").includes("Search Store"), "Order Sender store search missing");
    assert(read("components/order-sender-board.tsx").includes("/api/admin/stores/search"), "Order Sender typeahead missing");
    assert(read("components/order-sender-board.tsx").includes("Distribute All"), "Order Sender distribute-all missing");
    assert(read("components/order-sender-board.tsx").includes("Select all"), "Order Sender select-all missing");
    assert(read("lib/actions/admin.ts").includes('intent === "all"'), "Order Sender batch distribute missing");
    assert(read("lib/actions/admin.ts").includes("isListedProduct"), "Order Sender must use listed products");
    assert(
      read("lib/actions/auth.ts").includes("username") || read("lib/login-db.ts").includes("username"),
      "Login does not accept username",
    );
    assert(!/virtual.?order|auto.?order/i.test(admin), "Forbidden order-generation terms in admin actions");
  });
}

async function phase6Database(prisma) {
  await check(6, "Seed has ledger entries and payouts in several statuses", async () => {
    const ledger = await prisma.ledgerEntry.count();
    assert(ledger > 0, "No ledger rows");
    for (const status of ["PENDING", "APPROVED", "PAID"]) {
      const count = await prisma.payout.count({ where: { status } });
      assert(count > 0, `No ${status} payouts`);
    }
  });

  await check(6, "Products share one record with On Shelf and Listed statuses", async () => {
    const listed = await prisma.product.count({ where: { listingStatus: "LISTED" } });
    const shelf = await prisma.product.count({ where: { listingStatus: "ON_SHELF" } });
    assert(listed > 0, "No listed products");
    assert(shelf > 0, "No on-shelf products");
  });

  await check(6, "Expired service sessions leave chat history in place", async () => {
    const merchant = await prisma.merchant.findFirst();
    assert(merchant, "Need a store");
    const thread = await prisma.supportThread.upsert({
      where: { merchantId: merchant.id },
      update: {},
      create: { merchantId: merchant.id },
    });
    const row = await prisma.supportSession.create({
      data: {
        threadId: thread.id,
        merchantId: merchant.id,
        startedAt: new Date(Date.now() - 3_600_000),
        expiresAt: new Date(Date.now() - 1_000),
        status: "ACTIVE",
      },
    });
    await prisma.supportMessage.create({
      data: { threadId: thread.id, sessionId: row.id, sender: "BOT", body: "Welcome to our Support Service." },
    });
    await prisma.supportSession.updateMany({
      where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
      data: { status: "EXPIRED" },
    });
    const expired = await prisma.supportSession.findUnique({ where: { id: row.id } });
    const kept = await prisma.supportMessage.count({ where: { sessionId: row.id } });
    assert(expired.status === "EXPIRED", "Session should expire server-side");
    assert(kept === 1, "Chat history must remain after expiry");
    await prisma.supportMessage.deleteMany({ where: { sessionId: row.id } });
    await prisma.supportSession.delete({ where: { id: row.id } });
  });

  await check(6, "Isolated payout: request then mark paid decrements available", async () => {
    const plan = await prisma.plan.findFirst();
    const merchant = await prisma.merchant.create({
      data: {
        name: "VERIFY Payout Store",
        slug: `verify-payout-${Date.now()}`,
        legalName: "VERIFY Payout LLC",
        email: "verify-payout@example.test",
        phone: "+1-555-0004",
        country: "US",
        city: "Test",
        address: "4 Verify Way",
        status: "ACTIVE",
        planId: plan.id,
        availableBalance: 100,
        pendingBalance: 0,
        bankName: "Verify Bank",
        bankAccountLast4: "4321",
      },
    });
    const payout = await prisma.payout.create({
      data: {
        payoutNumber: `VERIFY-PO-${Date.now()}`,
        merchantId: merchant.id,
        amount: 40,
        status: "PENDING",
        bankName: merchant.bankName,
        accountLast4: merchant.bankAccountLast4,
      },
    });
    await prisma.$transaction([
      prisma.payout.update({
        where: { id: payout.id },
        data: { status: "PAID", processedAt: new Date() },
      }),
      prisma.merchant.update({
        where: { id: merchant.id },
        data: { availableBalance: { decrement: 40 } },
      }),
      prisma.ledgerEntry.create({
        data: {
          merchantId: merchant.id,
          type: "PAYOUT",
          amount: -40,
          reference: payout.payoutNumber,
          note: "VERIFY bank payout",
        },
      }),
    ]);
    const fresh = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    assert(fresh.availableBalance === 60, `Available after payout was ${fresh.availableBalance}`);
    const entry = await prisma.ledgerEntry.findFirst({
      where: { merchantId: merchant.id, type: "PAYOUT" },
    });
    assert(entry?.amount === -40, "Payout ledger amount wrong");

    await prisma.ledgerEntry.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.payout.delete({ where: { id: payout.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  });

  await check(6, "Scheduled payment release posts once to available balance", async () => {
    const plan = await prisma.plan.findFirst();
    const merchant = await prisma.merchant.create({
      data: {
        name: "VERIFY Release Store",
        slug: `verify-release-${Date.now()}`,
        legalName: "VERIFY Release LLC",
        email: "verify-release@example.test",
        phone: "+1-555-0008",
        country: "US",
        city: "Test",
        address: "8 Verify Way",
        status: "ACTIVE",
        planId: plan.id,
        availableBalance: 5,
        pendingBalance: 10,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        name: "James Walker",
        email: `verify.release.${Date.now()}@example.test`,
        phone: "+1-555-0199",
        address: "1 Test St",
        city: "Austin",
        country: "United States",
      },
    });
    const category = await prisma.category.findFirst();
    const product = await prisma.product.create({
      data: {
        merchantId: merchant.id,
        categoryId: category.id,
        title: "VERIFY Release SKU",
        sku: `VERIFY-REL-${Date.now()}`,
        description: "Release fixture",
        price: 20,
        cost: 5,
        stock: 4,
        status: "ACTIVE",
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: `VERIFY-REL-${Date.now()}`,
        merchantId: merchant.id,
        customerId: customer.id,
        status: "PROCESSING",
        subtotal: 20,
        shippingFee: 0,
        tax: 0,
        total: 20,
        cost: 5,
        profit: 10,
        platformFee: 5,
        walletReleased: false,
        paidAt: new Date(),
        items: {
          create: {
            productId: product.id,
            title: product.title,
            sku: product.sku,
            quantity: 1,
            price: 20,
            cost: 5,
          },
        },
      },
    });
    const release = await prisma.paymentRelease.create({
      data: {
        orderId: order.id,
        merchantId: merchant.id,
        amount: 10,
        status: "SCHEDULED",
        releaseAt: new Date(Date.now() - 1000),
        createdById: "verify",
      },
    });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const row = await tx.paymentRelease.findFirst({
        where: { id: release.id, status: "SCHEDULED" },
      });
      assert(row, "Scheduled row missing");
      await tx.order.update({ where: { id: order.id }, data: { walletReleased: true } });
      await tx.merchant.update({
        where: { id: merchant.id },
        data: { pendingBalance: { decrement: 10 }, availableBalance: { increment: 10 } },
      });
      await tx.ledgerEntry.create({
        data: {
          merchantId: merchant.id,
          type: "SALE",
          amount: 10,
          reference: order.orderNumber,
          note: "VERIFY scheduled release",
        },
      });
      await tx.paymentRelease.update({
        where: { id: release.id },
        data: { status: "RELEASED", releasedAt: now },
      });
    });
    const again = await prisma.paymentRelease.updateMany({
      where: { id: release.id, status: "SCHEDULED" },
      data: { status: "RELEASED" },
    });
    assert(again.count === 0, "Released row was processed twice");
    const fresh = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    assert(fresh.availableBalance === 15, `Available after release was ${fresh.availableBalance}`);
    assert(fresh.pendingBalance === 0, `Pending after release was ${fresh.pendingBalance}`);
    const posted = await prisma.order.findUnique({ where: { id: order.id } });
    assert(posted.walletReleased, "Order was not marked released");

    await prisma.paymentRelease.delete({ where: { id: release.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.ledgerEntry.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  });
}

// ---------------------------------------------------------------------------
// Phase 7 static
// ---------------------------------------------------------------------------
async function phase7Static() {
  console.log("\nPhase 7 — Hosting and preview");
  await check(7, "start script bootstraps DB and binds PORT", () => {
    const pkg = JSON.parse(read("package.json"));
    assert(pkg.scripts.start.includes("scripts/start.mjs"), "start must use scripts/start.mjs");
    assert(pkg.engines?.node?.includes("20"), "engines.node must require Node 20+");
    const start = read("scripts/start.mjs");
    assert(start.includes("bootstrap.mjs"), "start does not bootstrap");
    assert(start.includes("0.0.0.0"), "start does not bind all interfaces");
    assert(start.includes("PORT"), "start ignores PORT");
    assert(start.includes("-p") && start.includes("resolvePort"), "start must accept Hostinger -p PORT");
    const ensure = read("lib/ensure-db.ts");
    assert(ensure.includes("installDemoDb") || ensure.includes("demo.sqlite"), "ensure-db does not install packed SQLite");
    assert(exists("prisma/demo.sqlite"), "prisma/demo.sqlite missing");
    assert(exists("scripts/copy-demo-db.mjs"), "scripts/copy-demo-db.mjs missing");
    assert(read("instrumentation.ts").includes("ensureDatabase"), "instrumentation does not prepare the database");
    const boot = read("scripts/bootstrap.mjs");
    assert(
      boot.includes("prisma") && boot.includes("dev.db"),
      "bootstrap looks in the wrong place for SQLite",
    );
    assert(boot.includes("prisma/seed.ts") || boot.includes("seed.ts"), "bootstrap does not seed");
    assert(exists("prisma.config.ts"), "prisma.config.ts missing");
    const pkgJson = read("package.json");
    assert(!pkgJson.includes('"seed": "tsx prisma/seed.ts"'), "package.json#prisma seed must move to prisma.config.ts");
    assert(pkgJson.includes("16.3.5") || pkgJson.includes("16.3.3"), "Next.js must be patched for Hostinger npm audit");
  });
  await check(7, "Session cookie can stay off Secure on plain HTTP", () => {
    const auth = read("lib/auth.ts");
    assert(auth.includes("AUTH_COOKIE_SECURE"), "AUTH_COOKIE_SECURE override missing");
    assert(auth.includes("cookieSecure"), "cookieSecure helper missing");
    const envExample = read(".env.example");
    assert(envExample.includes("AUTH_COOKIE_SECURE"), ".env.example missing AUTH_COOKIE_SECURE");
  });
  await check(7, "Preview hosts are allowed for Server Actions", () => {
    const config = read("next.config.js");
    assert(config.includes("allowedDevOrigins"), "allowedDevOrigins missing");
    assert(config.includes("*.agent.cvm.dev"), "agent.cvm.dev origin missing");
    assert(config.includes("*.cursorvm.com"), "cursorvm.com origin missing");
    assert(config.includes("*.hostingersite.com"), "hostingersite.com origin missing");
    assert(config.includes("allowedOrigins"), "serverActions.allowedOrigins missing");
    assert(!/p-3000-pod-/.test(config), "stale Cursor pod hostname in next.config.js");
    assert(!/\.agent\.cvm\.dev/.test(config.replaceAll("*.agent.cvm.dev", "")), "stale agent.cvm.dev hostname");
    assert(!read("package.json").includes("clean-next-config"), "build must not delete Next hashed config files");
    assert(!exists("scripts/clean-next-config.mjs"), "leftover config cleaner would break Hostinger builds");
    assert(read("package.json").includes("next build --webpack"), "Hostinger must build with webpack because native SWC needs GLIBC 2.29");
    assert(read("scripts/start.mjs").includes("--webpack"), "start rebuild must use webpack on Hostinger");
    assert(read("next.config.js").includes("module.exports"), "Hostinger needs CommonJS next.config.js");
  });
  await check(7, "README documents Hostinger Node hosting, not PHP public_html", () => {
    const readme = read("README.md");
    assert(readme.includes("Hostinger"), "Hostinger section missing");
    assert(/not run as a normal PHP site|public_html/.test(readme), "PHP warning missing");
    assert(readme.includes("AUTH_SECRET"), "AUTH_SECRET warning missing");
    assert(readme.includes("SSL") || readme.includes("Let’s Encrypt") || readme.includes("Let's Encrypt"), "SSL note missing");
    assert(readme.includes("npm run start"), "Hostinger start command should be npm run start");
    assert(exists("PROJECT_PLAN.md"), "PROJECT_PLAN.md missing");
    assert(exists("USAGE.md"), "USAGE.md missing");
    assert(exists("HOSTINGER.md"), "HOSTINGER.md missing");
    assert(exists("hostinger.env.example"), "hostinger.env.example missing");
    const hostinger = read("HOSTINGER.md");
    assert(/Free subdomain|temporary domain/i.test(hostinger), "HOSTINGER.md missing temporary domain steps");
    assert(hostinger.includes("hostingersite.com"), "HOSTINGER.md missing hostingersite.com");
    const usage = read("USAGE.md");
    assert(usage.includes("localhost:3000/welcome"), "USAGE.md missing local login URL");
    assert(usage.includes("Hostinger"), "USAGE.md missing Hostinger steps");
    assert(/phone|Wi-Fi|Wi‑Fi|other device/i.test(usage), "USAGE.md missing other-device access steps");
    assert(exists("scripts/lan-urls.mjs"), "scripts/lan-urls.mjs missing");
    assert(exists("scripts/dev.mjs"), "scripts/dev.mjs missing");
    const pkg = JSON.parse(read("package.json"));
    assert(pkg.scripts.urls?.includes("lan-urls"), "npm run urls missing");
    assert(pkg.scripts.dev.includes("scripts/dev.mjs"), "dev must bind via scripts/dev.mjs");
  });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
function locationPath(res) {
  const loc = res.headers.get("location") || "";
  try {
    return new URL(loc, baseUrl).pathname;
  } catch {
    return loc;
  }
}

async function fetchManual(url, options = {}) {
  return fetch(url, { redirect: "manual", ...options });
}

async function mintCookie(user) {
  const { SignJWT } = await import("jose");
  const secret = process.env.AUTH_SECRET;
  assert(secret, "AUTH_SECRET is not set");
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    merchantId: user.merchantId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));
  return `harbor_session=${token}`;
}

async function getWithCookie(pathname, cookie) {
  return fetchManual(`${baseUrl}${pathname}`, {
    headers: cookie ? { cookie } : {},
  });
}

async function pageText(pathname, cookie) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    headers: cookie ? { cookie } : {},
    redirect: "follow",
  });
  const text = await res.text();
  return { res, text };
}

async function phaseHttp(prisma) {
  console.log(`\nHTTP checks against ${baseUrl}`);
  await check(7, "Server is reachable", async () => {
    const res = await fetchManual(`${baseUrl}/login`);
    assert(res.status === 200, `/login returned ${res.status}`);
  });
  await check(1, "Anonymous / redirects to /login", async () => {
    const res = await getWithCookie("/");
    assert([301, 302, 303, 307, 308].includes(res.status), `Expected redirect, got ${res.status}`);
    assert(locationPath(res) === "/welcome", `Redirected to ${locationPath(res)}`);
  });
  await check(2, "Login HTML uses the product name, not a marketplace clone", async () => {
    const { res, text } = await pageText("/login");
    assert(res.status === 200, `/login ${res.status}`);
    assert(/TikiTok Shop/.test(text), "Login HTML missing product name");
    assert(/signup/i.test(text), "Login HTML missing Sign up");
    assert(!/HarborAdmin!2026|HarborMerchant!2026|HarborOps!2026/.test(text), "Login HTML leaked demo passwords");
  });
  await check(2, "Role login URLs are separate and unauthenticated admin routes use Super Admin login", async () => {
    for (const pathname of ["/login/admin", "/login/ops", "/login/store", "/login/support", "/welcome"]) {
      const res = await fetchManual(`${baseUrl}${pathname}`);
      assert(res.status === 200, `${pathname} returned ${res.status}`);
    }
    const welcome = await pageText("/welcome");
    assert(welcome.res.status === 200, `/welcome ${welcome.res.status}`);
    assert(hasHref(welcome.text, "/login/store"), "Welcome missing Store Login");
    assert(hasHref(welcome.text, "/login/ops"), "Welcome missing Normal Backend Login");
    assert(hasHref(welcome.text, "/login/admin"), "Welcome missing Super Admin Login");
    assert(!hasHref(welcome.text, "/login/support"), "Welcome leaked Support Desk login");
    assert(!welcome.text.includes("Support Desk"), "Welcome leaked Support Desk");
    const loginIndex = await pageText("/login");
    assert(!hasHref(loginIndex.text, "/login/support"), "Login index leaked Support Desk login");
    const supportGate = await getWithCookie("/support-desk");
    assert([301, 302, 303, 307, 308].includes(supportGate.status), `/support-desk was ${supportGate.status}`);
    assert(locationPath(supportGate) === "/login/support", `/support-desk redirected to ${locationPath(supportGate)}`);
    const adminGate = await getWithCookie("/admin/place-order");
    assert([301, 302, 303, 307, 308].includes(adminGate.status), `/admin/place-order was ${adminGate.status}`);
    assert(locationPath(adminGate) === "/login/admin", `Admin gate redirected to ${locationPath(adminGate)}`);
    const storeGate = await getWithCookie("/distribution");
    assert(locationPath(storeGate) === "/login/store", `Store gate redirected to ${locationPath(storeGate)}`);
    const opsGate = await getWithCookie("/merchants");
    assert(locationPath(opsGate) === "/login/ops", `Ops gate redirected to ${locationPath(opsGate)}`);
  });
  await check(2, "Anonymous signup and shop card are public", async () => {
    const signup = await fetchManual(`${baseUrl}/signup`);
    assert(signup.status === 200, `/signup returned ${signup.status}`);
    const signupHtml = await pageText("/signup");
    assert(signupHtml.text.includes("LLC Code"), "Signup HTML missing LLC Code");
    assert(!signupHtml.text.includes("LLC Code (optional)"), "Signup HTML still labels LLC Code optional");
    assert(signupHtml.text.includes("Logo"), "Signup HTML missing Logo picker");
    assert(!signupHtml.text.includes("Referral code"), "Signup HTML still says Referral code");
    const { res, text } = await pageText("/s/northline-outfitters");
    assert(res.status === 200, `/s/northline-outfitters ${res.status}`);
    assert(/TikiTok Shop/.test(text), "Shop card missing product name");
    assert(/Seller login|Sign in/.test(text), "Shop card missing seller login");
    assert(/northline-outfitters/.test(text), "Shop card missing slug");
  });

  const admin = await prisma.user.findUnique({ where: { email: "oscar.d@example.net" } });
  const ops = await prisma.user.findUnique({ where: { email: "sarah.b@example.net" } });
  const merchant = await prisma.user.findUnique({
    where: { email: "iris.p@example.org" },
    include: { merchant: true },
  });
  const adminCookie = await mintCookie(admin);
  const opsCookie = await mintCookie(ops);
  const merchantCookie = await mintCookie(merchant);

  const staffRoutes = [
    "/",
    "/orders",
    "/refunds",
    "/shipping",
    "/products",
    "/categories",
    "/reviews",
    "/merchants",
    "/merchants/applications",
    "/merchants/plans",
    "/customers",
    "/finance",
    "/finance/payouts",
    "/notifications",
    "/profile",
    "/service",
    "/support-desk",
  ];
  const adminRoutes = [
    "/users",
    "/settings",
    "/admin/place-order",
    "/admin/funds",
    "/admin/releases",
    "/admin/users",
    "/admin/broadcast",
    "/admin/stores",
  ];
  await check(7, "Super admin can open every operations route", async () => {
    for (const pathname of [...staffRoutes, ...adminRoutes]) {
      if (pathname === "/service") {
        const res = await getWithCookie(pathname, adminCookie);
        assert([301, 302, 303, 307, 308].includes(res.status), `/service was ${res.status} for admin`);
        assert(locationPath(res) === "/support-desk", `/service redirected admin to ${locationPath(res)}`);
        continue;
      }
      const res = await getWithCookie(pathname, adminCookie);
      assert(res.status === 200, `${pathname} returned ${res.status} for admin`);
    }
  });
  await check(2, "Ops can open staff pages but not Team or Settings", async () => {
    for (const pathname of staffRoutes) {
      if (pathname === "/service") {
        const res = await getWithCookie(pathname, opsCookie);
        assert([301, 302, 303, 307, 308].includes(res.status), `/service was ${res.status} for ops`);
        assert(locationPath(res) === "/support-desk", `/service redirected ops to ${locationPath(res)}`);
        continue;
      }
      const res = await getWithCookie(pathname, opsCookie);
      assert(res.status === 200, `${pathname} returned ${res.status} for ops`);
    }
    for (const pathname of adminRoutes) {
      const res = await getWithCookie(pathname, opsCookie);
      assert([301, 302, 303, 307, 308].includes(res.status), `${pathname} was ${res.status} for ops`);
      assert(locationPath(res) === "/", `${pathname} redirected ops to ${locationPath(res)}`);
    }
  });
  await check(2, "Admin dashboard HTML includes Team, Settings, and operations overview", async () => {
    const { text } = await pageText("/", adminCookie);
    assert(text.includes("Operations overview"), "Admin dashboard title missing");
    assert(hasHref(text, "/users"), "Admin nav missing Team");
    assert(hasHref(text, "/settings"), "Admin nav missing Settings");
    assert(hasHref(text, "/merchants"), "Admin nav missing Merchants");
    assert(hasHref(text, "/admin/place-order"), "Admin nav missing Place order");
    assert(text.includes("Order Sender"), "Admin nav missing Order Sender label");
    assert(hasHref(text, "/admin/funds"), "Admin nav missing Add funds");
    assert(hasHref(text, "/support-desk"), "Admin nav missing Support Service");
    assert(!hasHref(text, "/service"), "Admin nav leaked store Service");
    assert(!hasHref(text, "/login/support"), "Admin nav leaked Support Desk login");
    assert(text.includes("Needs attention"), "Admin attention queue missing");
  });
  await check(2, "Ops dashboard HTML omits Team and Settings", async () => {
    const { text } = await pageText("/", opsCookie);
    assert(text.includes("Operations overview"), "Ops dashboard title missing");
    assert(hasHref(text, "/merchants"), "Ops nav missing Merchants");
    assert(!hasHref(text, "/support-desk"), "Ops nav leaked Support Service");
    assert(!hasHref(text, "/service"), "Ops nav leaked store Service");
    assert(!hasHref(text, "/users"), "Ops nav leaked Team");
    assert(!hasHref(text, "/settings"), "Ops nav leaked Settings");
    assert(!hasHref(text, "/admin/place-order"), "Ops nav leaked Place order");
    assert(!hasHref(text, "/admin/support"), "Ops nav leaked Super Admin support path");
    assert(!hasHref(text, "/login/support"), "Ops nav leaked Support Desk login");
  });

  const merchantAllowed = [
    "/",
    "/orders",
    "/refunds",
    "/shipping",
    "/products",
    "/reviews",
    "/finance",
    "/finance/payouts",
    "/notifications",
    "/profile",
    "/service",
    "/distribution",
    "/withdraw",
    "/account",
    "/recharge",
  ];
  const merchantBlocked = [
    "/merchants",
    "/merchants/applications",
    "/merchants/plans",
    "/customers",
    "/categories",
    "/users",
    "/settings",
    "/admin/place-order",
    "/admin/funds",
    "/admin/releases",
    "/admin/users",
    "/admin/broadcast",
    "/admin/stores",
    "/admin/support",
    "/support-desk",
  ];
  await check(2, "Merchant can open store pages and is blocked from staff pages", async () => {
    for (const pathname of merchantAllowed) {
      const res = await getWithCookie(pathname, merchantCookie);
      assert(res.status === 200, `${pathname} returned ${res.status} for merchant`);
    }
    for (const pathname of merchantBlocked) {
      const res = await getWithCookie(pathname, merchantCookie);
      assert([301, 302, 303, 307, 308].includes(res.status), `${pathname} was ${res.status} for merchant`);
      assert(locationPath(res) === "/", `${pathname} redirected merchant to ${locationPath(res)}`);
    }
  });
  await check(2, "Merchant dashboard HTML is store-scoped and hides staff nav", async () => {
    const { text } = await pageText("/", merchantCookie);
    assert(text.includes("Store overview"), "Merchant dashboard title missing");
    assert(text.includes("Northline Outfitters"), "Store name missing from merchant workspace");
    assert(text.includes("Available balance"), "Merchant wallet missing");
    assert(hasHref(text, "/service"), "Merchant dashboard missing Service");
    assert(!hasHref(text, "/admin/support"), "Merchant nav leaked Support Service");
    assert(!hasHref(text, "/support-desk"), "Merchant nav leaked Support Desk");
    assert(!hasHref(text, "/login/support"), "Merchant nav leaked Support Desk login");
    assert(text.includes("/c4/") || text.includes("/catalog/") || text.includes("/product-art/") || text.includes("/products/p"), "Merchant dashboard missing product images");
    assert(hasHref(text, "/distribution"), "Merchant dashboard missing Distribution");
    assert(!hasHref(text, "/merchants"), "Merchant nav leaked Merchants");
    assert(!hasHref(text, "/merchants/applications"), "Merchant nav leaked Applications");
    assert(!hasHref(text, "/customers"), "Merchant nav leaked Customers");
    assert(!hasHref(text, "/categories"), "Merchant nav leaked Categories");
    assert(!hasHref(text, "/users"), "Merchant nav leaked Team");
    assert(!hasHref(text, "/settings"), "Merchant nav leaked Settings");
    assert(!hasHref(text, "/admin/place-order"), "Merchant nav leaked Place order");
  });

  await check(3, "Merchant /orders HTML is scoped to Northline Outfitters", async () => {
    const { res, text } = await pageText("/orders", merchantCookie);
    assert(res.status === 200, `/orders ${res.status}`);
    assert(text.includes("Northline Outfitters"), "Merchant orders missing own store");
    assert(!text.includes("Cedar &amp; Co") && !text.includes("Cedar & Co. Home"), "Merchant orders leaked Cedar & Co.");
    assert(!text.includes("Lumen Beauty"), "Merchant orders leaked Lumen Beauty");
    assert(text.includes("Click to Pick Up"), "Merchant orders missing pickup control");
    assert(text.includes("Unpaid"), "Merchant new orders missing Unpaid status");
    assert(text.includes("Cost Price") && text.includes("Total Price") && text.includes("Profit Amount"), "Merchant orders missing cost/total/profit");
    assert(text.includes("/c4/") || text.includes("/catalog/") || text.includes("/product-art/") || text.includes("/products/p"), "Merchant orders missing product images");
  });
  await check(3, "Distribution Center shows listing status on products", async () => {
    const { res, text } = await pageText("/distribution", merchantCookie);
    assert(res.status === 200, `/distribution ${res.status}`);
    assert(text.includes("On Shelf"), "Distribution missing On Shelf");
    assert(text.includes("Listed"), "Distribution missing Listed");
    assert(text.includes("Profit Margin"), "Distribution missing profit margin");
    assert(text.includes("Cost Price"), "Distribution missing cost price");
    assert(text.includes('name="listingStatus"'), "Distribution missing listing status control");
    assert(text.includes("overflow-x-auto"), "Distribution missing horizontal category scroller");
    assert(text.includes("Hot Selling Items") && text.includes("Computer accessories"), "Distribution missing category tabs");
    assert(text.includes("/distribution?category="), "Distribution category links missing");
    const computers = await pageText("/distribution?category=computer-accessories", merchantCookie);
    assert(computers.res.status === 200, `/distribution?category=computer-accessories ${computers.res.status}`);
    assert(computers.text.includes("Wireless Mouse") || computers.text.includes("Thunderbolt Dock"), "Computer accessories products missing");
    assert(!computers.text.includes("Trail Fleece Jacket"), "Category filter leaked another category");
  });
  await check(3, "Order Sender lists stores and listed products", async () => {
    const northline = await prisma.merchant.findUnique({ where: { slug: "northline-outfitters" } });
    assert(northline, "Northline store missing");
    const blank = await pageText("/admin/place-order", adminCookie);
    assert(blank.res.status === 200, `/admin/place-order ${blank.res.status}`);
    assert(blank.text.includes("Order Sender"), "Order Sender title missing");
    assert(blank.text.includes("Search Store"), "Search Store missing");
    assert(!blank.text.includes("Cedar &amp; Co") && !blank.text.includes("Cedar & Co. Home"), "Order Sender listed all stores without a search");
    const { res, text } = await pageText(`/admin/place-order?merchantId=${northline.id}`, adminCookie);
    assert(res.status === 200, `/admin/place-order ${res.status}`);
    assert(text.includes("Order Sender"), "Order Sender title missing");
    assert(text.includes("Search Store"), "Search Store missing");
    assert(text.includes("Northline Outfitters"), "Selected store missing Northline");
    assert(text.includes("Trail Fleece Jacket") || text.includes("Alpine Daypack"), "Listed Northline products missing");
    assert(!text.includes("Insulated Water Bottle"), "On-shelf product leaked into Order Sender");
    assert(text.includes("Distribute"), "Distribute action missing");
    assert(text.includes("Select all"), "Select all missing");
    assert(text.includes("Order details"), "Sticky order details missing");
    const search = await fetch(`${baseUrl}/api/admin/stores/search?q=north`, {
      headers: { cookie: adminCookie, accept: "application/json" },
    });
    assert(search.status === 200, `Store search ${search.status}`);
    const searchJson = await search.json();
    assert(
      (searchJson.stores || []).some((item) => item.name === "Northline Outfitters"),
      "Store search suggestions missing Northline",
    );
    const blocked = await fetch(`${baseUrl}/api/admin/stores/search?q=north`, {
      headers: { cookie: merchantCookie, accept: "application/json" },
    });
    assert(blocked.status === 403 || blocked.status === 401, `Merchant store search was ${blocked.status}`);
  });
  await check(3, "Store orders live API returns newest unpaid pickup cards", async () => {
    const live = await fetch(`${baseUrl}/ol1`, {
      headers: { cookie: merchantCookie, accept: "application/json", "cache-control": "no-store" },
    });
    assert(live.status === 200, `Orders live ${live.status}`);
    assert((live.headers.get("cache-control") || "").includes("no-store"), "Orders live API is cacheable");
    const json = await live.json();
    assert(Array.isArray(json.orders) && json.orders.length > 0, "Orders live API returned no orders");
    const unpaid = json.orders.filter((order) => order.status === "PENDING_PAYMENT");
    assert(unpaid.length > 0, "Orders live API missing unpaid pickup orders");
    assert(unpaid.some((order) => order.orderNumber?.startsWith("HB-2026-PICKUP-")), "Pickup demo orders missing from live API");
    const times = json.orders.map((order) => Date.parse(order.updatedAt));
    const sorted = [...times].sort((a, b) => b - a);
    assert(times.every((value, index) => value === sorted[index]), "Live orders are not newest-first");
    const alias = await fetch(`${baseUrl}/api/orders/live`, {
      headers: { cookie: merchantCookie, accept: "application/json" },
    });
    assert(alias.status === 200, `Orders live alias ${alias.status}`);
    const anon = await fetchManual(`${baseUrl}/ol1`, {
      headers: { accept: "application/json" },
    });
    assert(
      [401, 301, 302, 303, 307, 308].includes(anon.status),
      `Anonymous orders live was ${anon.status}`,
    );
  });
  await check(3, "Admin /orders HTML includes multiple merchants", async () => {
    const { text } = await pageText("/orders", adminCookie);
    assert(text.includes("Northline Outfitters"), "Admin orders missing Northline");
    assert(text.includes("Cedar") || text.includes("Lumen"), "Admin orders missing other stores");
  });
  await check(3, "Order detail, shipping, and refunds pages load", async () => {
    const sample = await prisma.order.findFirst({
      where: { merchant: { slug: "northline-outfitters" } },
      orderBy: { createdAt: "desc" },
    });
    assert(sample, "No Northline order to open");
    const detail = await getWithCookie(`/orders/${sample.id}`, adminCookie);
    assert(detail.status === 200, `Admin order detail ${detail.status}`);
    const shipping = await pageText("/shipping", adminCookie);
    assert(shipping.res.status === 200, `/shipping ${shipping.res.status}`);
    assert(shipping.text.includes("Ready to ship"), "Ready-to-ship queue missing");
    assert(shipping.text.includes("UPS"), "Carrier UPS missing");
    const refunds = await pageText("/refunds", adminCookie);
    assert(refunds.res.status === 200, `/refunds ${refunds.res.status}`);
    assert(refunds.text.includes("Approve") || refunds.text.includes("RF-"), "Refund queue missing");
  });
  await check(3, "Merchant cannot open another store's order", async () => {
    const foreign = await prisma.order.findFirst({
      where: { merchant: { slug: { not: "northline-outfitters" } } },
    });
    assert(foreign, "Need a non-Northline order");
    const res = await getWithCookie(`/orders/${foreign.id}`, merchantCookie);
    assert(res.status === 404, `Foreign order returned ${res.status}, expected 404`);
    const own = await prisma.order.findFirst({
      where: { merchant: { slug: "northline-outfitters" } },
    });
    const ok = await getWithCookie(`/orders/${own.id}`, merchantCookie);
    assert(ok.status === 200, `Own order returned ${ok.status}`);
  });
  await check(4, "Staff merchant/application/plan pages load with seeded sellers", async () => {
    const list = await pageText("/merchants", adminCookie);
    assert(list.res.status === 200, `/merchants ${list.res.status}`);
    assert(list.text.includes("Northline Outfitters"), "Merchant list missing Northline");
    assert(list.text.includes("BrightByte") || list.text.includes("Suspended"), "Suspended merchant missing");
    const apps = await pageText("/merchants/applications", adminCookie);
    assert(apps.res.status === 200, `/merchants/applications ${apps.res.status}`);
    assert(apps.text.includes("Solstice") || apps.text.includes("Greenfield"), "Pending applications missing");
    assert(apps.text.includes("Log inbound seller"), "Inbound intake missing");
    const plans = await pageText("/merchants/plans", adminCookie);
    assert(plans.res.status === 200, `/merchants/plans ${plans.res.status}`);
    assert(plans.text.includes("Starter") && plans.text.includes("Growth") && plans.text.includes("Scale"), "Plans missing");
    const sample = await prisma.merchant.findFirst({ where: { slug: "northline-outfitters" } });
    const detail = await getWithCookie(`/merchants/${sample.id}`, adminCookie);
    assert(detail.status === 200, `Merchant detail ${detail.status}`);
    const blocked = await getWithCookie(`/merchants/${sample.id}`, merchantCookie);
    assert([301, 302, 303, 307, 308].includes(blocked.status), `Merchant opened store admin page (${blocked.status})`);
    assert(locationPath(blocked) === "/", "Merchant was not sent home from store admin");
  });
  await check(5, "Merchant /products HTML is store-scoped", async () => {
    const { text } = await pageText("/products", merchantCookie);
    assert(text.includes("Trail Fleece") || text.includes("Alpine Daypack") || text.includes("Merino"), "Northline products missing");
    assert(!text.includes("Vitamin C Serum"), "Merchant products leaked Lumen catalog");
  });
  await check(5, "Merchant cannot open another store's product; staff catalog pages load", async () => {
    const foreign = await prisma.product.findFirst({
      where: { merchant: { slug: { not: "northline-outfitters" } } },
    });
    assert(foreign, "Need a non-Northline product");
    const denied = await getWithCookie(`/products/${foreign.id}`, merchantCookie);
    assert(denied.status === 404, `Foreign product returned ${denied.status}`);
    const own = await prisma.product.findFirst({
      where: { merchant: { slug: "northline-outfitters" } },
    });
    const allowed = await getWithCookie(`/products/${own.id}`, merchantCookie);
    assert(allowed.status === 200, `Own product returned ${allowed.status}`);
    const createPage = await getWithCookie("/products/new", merchantCookie);
    assert(createPage.status === 200, `/products/new ${createPage.status}`);
    const reviews = await pageText("/reviews", merchantCookie);
    assert(reviews.res.status === 200, `/reviews ${reviews.res.status}`);
    assert(!reviews.text.includes("Vitamin C Serum"), "Merchant reviews leaked Lumen");
    const categories = await pageText("/categories", adminCookie);
    assert(categories.res.status === 200, `/categories ${categories.res.status}`);
    assert(categories.text.includes("Hot Selling Items"), "Categories missing Hot Selling Items");
    assert(categories.text.includes("Fitness Equipment"), "Categories missing Fitness Equipment");
    assert(categories.text.includes("Beauty and skincare"), "Categories missing Beauty and skincare");
    const customers = await pageText("/customers", adminCookie);
    assert(customers.res.status === 200, `/customers ${customers.res.status}`);
    assert(customers.text.includes("Elena") || customers.text.includes("@shopper.example"), "Customers missing seed shoppers");
    const shopper = await prisma.customer.findFirst();
    const customerPage = await getWithCookie(`/customers/${shopper.id}`, adminCookie);
    assert(customerPage.status === 200, `Customer detail ${customerPage.status}`);
    const merchantCustomer = await getWithCookie(`/customers/${shopper.id}`, merchantCookie);
    assert([301, 302, 303, 307, 308].includes(merchantCustomer.status), "Merchant opened a customer record");
  });
  await check(6, "Finance, payouts, and workspace pages load with role rules", async () => {
    const ledger = await pageText("/finance", adminCookie);
    assert(ledger.res.status === 200, `/finance ${ledger.res.status}`);
    assert(ledger.text.includes("Available to payout"), "Ledger totals missing");
    const merchantLedger = await pageText("/finance", merchantCookie);
    assert(merchantLedger.res.status === 200, `Merchant /finance ${merchantLedger.res.status}`);
    assert(!merchantLedger.text.includes("Lumen Beauty"), "Merchant ledger leaked Lumen");
    const payouts = await pageText("/finance/payouts", adminCookie);
    assert(payouts.res.status === 200, `/finance/payouts ${payouts.res.status}`);
    assert(payouts.text.includes("PO-") || payouts.text.includes("Approve") || payouts.text.includes("Payouts"), "Payouts page empty of controls");
    const merchantPayouts = await pageText("/finance/payouts", merchantCookie);
    assert(merchantPayouts.res.status === 200, `Merchant payouts ${merchantPayouts.res.status}`);
    assert(merchantPayouts.text.includes("Available"), "Merchant available balance missing on payout form");
    const service = await pageText("/service", merchantCookie);
    assert(service.res.status === 200, `Merchant /service ${service.res.status}`);
    assert(service.text.includes("Store ID"), "Service missing store identity");
    assert(service.text.includes("Northline Outfitters"), "Service missing logged-in store name");
    assert(service.text.includes("TikiTok Shop Service assistant") || service.text.includes("assistant"), "Service assistant missing");
    assert(!service.text.includes("Time Remaining"), "Store Service must not show the countdown");
    const supportInbox = await pageText("/support-desk", adminCookie);
    assert(supportInbox.res.status === 200, `Admin /support-desk ${supportInbox.res.status}`);
    assert(supportInbox.text.includes("Active Service Sessions"), "Support Service inbox missing active list");
    assert(supportInbox.text.includes("Northline Outfitters"), "Support Service inbox missing store name");
    assert(supportInbox.text.includes("Store ID"), "Support Service inbox missing Store ID");
    const northline = await prisma.merchant.findFirst({ where: { name: "Northline Outfitters" } });
    assert(northline, "Northline store missing");
    const supportThread = await pageText(`/support-desk/${northline.id}`, adminCookie);
    assert(supportThread.res.status === 200, `Admin support thread ${supportThread.res.status}`);
    assert(supportThread.text.includes("Time Remaining") || supportThread.text.includes("TIME REMAINING") || supportThread.text.includes("Service Session Expired"), "Support backend chat missing timer");
    assert(supportThread.text.includes("Northline Outfitters"), "Support backend chat missing store name");
    assert(supportThread.text.includes("Store ID"), "Support backend chat missing Store ID");
    const opsDesk = await getWithCookie("/support-desk", opsCookie);
    assert(opsDesk.status === 200, `Ops /support-desk ${opsDesk.status}`);
    const profile = await pageText("/profile", merchantCookie);
    assert(profile.res.status === 200, `Merchant /profile ${profile.res.status}`);
    assert(profile.text.includes("Available balance"), "Store profile missing server balance");
    const accountPage = await pageText("/account", merchantCookie);
    assert(accountPage.res.status === 200, `Merchant /account ${accountPage.res.status}`);
    assert(accountPage.text.includes("Change payment password"), "Store account missing payment password form");
    assert(accountPage.text.includes("Change login password"), "Store account missing login password form");
    assert(!accountPage.text.includes("Current payment password"), "Store account still shows current payment password");
    assert(!accountPage.text.includes("Current login password"), "Store account still shows current login password");
    const adminProfile = await getWithCookie("/profile", adminCookie);
    assert(adminProfile.status === 200, `/profile ${adminProfile.status}`);
    const notes = await getWithCookie("/notifications", adminCookie);
    assert(notes.status === 200, `/notifications ${notes.status}`);
  });
  await check(3, "Support live API delivers store messages and typing without a page reload", async () => {
    const northline = await prisma.merchant.findFirst({ where: { name: "Northline Outfitters" } });
    assert(northline, "Northline store missing");
    const marker = `LIVE-${Date.now()}`;
    const form = new FormData();
    form.set("merchantId", northline.id);
    form.set("body", marker);
    const send = await fetch(`${baseUrl}/api/support/live`, {
      method: "POST",
      headers: { cookie: merchantCookie },
      body: form,
    });
    assert(send.status === 200, `Store live send ${send.status}`);
    const sendJson = await send.json();
    assert(sendJson.ok && sendJson.message?.body === marker, "Store live send did not return the message");

    const typing = await fetch(`${baseUrl}/api/support/live`, {
      method: "POST",
      headers: { cookie: merchantCookie, "content-type": "application/json" },
      body: JSON.stringify({ merchantId: northline.id, typing: true }),
    });
    assert(typing.status === 200, `Store typing ping ${typing.status}`);

    const inbox = await fetch(`${baseUrl}/api/support/live?inbox=1`, {
      headers: { cookie: adminCookie, accept: "application/json" },
    });
    assert(inbox.status === 200, `Support inbox live ${inbox.status}`);
    const inboxJson = await inbox.json();
    const row = (inboxJson.inbox?.active || []).find((item) => item.merchantId === northline.id);
    assert(row, "Support inbox live poll missing the store after send");
    assert(String(row.lastPreview || "").includes(marker), "Support inbox did not receive the live store message");
    assert(row.typing, "Support inbox missing store typing indicator");

    const thread = await fetch(`${baseUrl}/api/support/live?merchantId=${encodeURIComponent(northline.id)}`, {
      headers: { cookie: adminCookie, accept: "application/json" },
    });
    assert(thread.status === 200, `Support thread live ${thread.status}`);
    const threadJson = await thread.json();
    assert(
      threadJson.thread?.messages?.some((item) => item.body === marker),
      "Support thread live poll missing the store message",
    );
    assert(threadJson.thread?.typing?.store, "Support thread missing store typing indicator");

    const agentForm = new FormData();
    agentForm.set("merchantId", northline.id);
    agentForm.set("body", `AGENT-${marker}`);
    const reply = await fetch(`${baseUrl}/api/support/live`, {
      method: "POST",
      headers: { cookie: adminCookie },
      body: agentForm,
    });
    assert(reply.status === 200, `Agent live reply ${reply.status}`);
    const replyJson = await reply.json();
    assert(replyJson.ok && replyJson.message?.body === `AGENT-${marker}`, "Agent live reply failed");

    const storeThread = await fetch(`${baseUrl}/api/support/live?merchantId=${encodeURIComponent(northline.id)}`, {
      headers: { cookie: merchantCookie, accept: "application/json" },
    });
    assert(storeThread.status === 200, `Store live poll ${storeThread.status}`);
    const storeJson = await storeThread.json();
    assert(
      storeJson.thread?.messages?.some((item) => item.body === `AGENT-${marker}`),
      "Store live poll missing the agent reply",
    );
  });
}

function printSummary() {
  console.log("\n────────────────────────────────────────");
  const byPhase = new Map();
  for (const row of results) {
    const bucket = byPhase.get(row.phase) ?? { pass: 0, fail: 0 };
    bucket[row.pass ? "pass" : "fail"] += 1;
    byPhase.set(row.phase, bucket);
  }
  for (const [phase, bucket] of [...byPhase.entries()].sort((a, b) => a[0] - b[0])) {
    const mark = bucket.fail ? "FAIL" : "PASS";
    console.log(`Phase ${phase}: ${mark}  (${bucket.pass} passed, ${bucket.fail} failed)`);
  }
  console.log(`Total: ${results.length - failed} passed, ${failed} failed`);
  if (failed) {
    console.log("\nFailed checks:");
    for (const row of results.filter((item) => !item.pass)) {
      console.log(`  • Phase ${row.phase}: ${row.name} — ${row.error}`);
    }
  }
}

async function main() {
  process.chdir(root);
  loadEnv();
  console.log("TikTok Shop — phase verification");
  console.log(httpMode ? `Mode: source + database + HTTP (${baseUrl})` : "Mode: source + database");

  await phase1Static();
  await phase2Static();
  await phase3Static();
  await phase4Static();
  await phase5Static();
  await phase6Static();
  await phase7Static();

  if (!exists("node_modules/@prisma/client")) {
    fail(1, "Prisma client is generated", "Run npm install && npm run setup");
    printSummary();
    process.exit(1);
  }

  loadEnv();
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "file:./dev.db";

  const { PrismaClient } = require("@prisma/client");
  const bcrypt = require("bcryptjs");
  const prisma = new PrismaClient();
  try {
    await phase1Database(prisma, bcrypt);
    await phase2Database(prisma);
    await phase3Database(prisma);
    await phase4Database(prisma);
    await phase5Database(prisma);
    await phase6Database(prisma);
    if (httpMode) {
      await phaseHttp(prisma);
    } else {
      console.log("\nSkipping HTTP (pass --http when the app is running).");
    }
  } finally {
    await prisma.$disconnect();
  }

  printSummary();
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
