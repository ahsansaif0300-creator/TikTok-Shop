#!/usr/bin/env node
/**
 * Phase checklist runner for Harbor Commerce OS.
 *   node scripts/verify-phases.mjs           # files + seed + lifecycle (phases 1–6)
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
  const allowed = ["app/", "components/", "lib/", "prisma/", "proxy.ts", "next.config.ts"];
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
    "app/login/page.tsx",
    "next.config.ts",
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
    ]) {
      assert(schema.includes(token), `Schema missing ${token}`);
    }
    assert(!/inviteCode|yuebao|virtualOrder|blockchain/i.test(schema), "Schema contains out-of-scope fields");
  });
  await check(1, "JWT session cookie is harbor_session", () => {
    const auth = read("lib/auth.ts");
    assert(auth.includes('harbor_session'), "Cookie name missing");
    assert(auth.includes("SignJWT") && auth.includes("jwtVerify"), "jose JWT helpers missing");
  });
  await check(1, "proxy.ts redirects anonymous users to /login", () => {
    const proxy = read("proxy.ts");
    assert(proxy.includes('pathname = "/login"'), "Login redirect missing");
    assert(proxy.includes("harbor_session"), "Session cookie not read");
  });
  await check(1, "No impersonation or trap-product code in app source", () => {
    const hits = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(file, "utf8");
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
    assert(name?.value === "Harbor Commerce", `storeName is ${name?.value}`);
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
      "lib/nav.ts",
      "lib/dashboard.ts",
      "app/(app)/page.tsx",
      "app/(app)/layout.tsx",
    ]) {
      assert(exists(file), `Missing ${file}`);
    }
    const chrome = read("components/workspace-chrome.tsx");
    assert(chrome.includes("Harbor") && chrome.includes("Commerce OS"), "Harbor mark missing from shell");
    assert(chrome.includes("logoutAction"), "Logout control missing");
    assert(chrome.includes("Open menu"), "Mobile menu control missing");
    const nav = read("lib/nav.ts");
    assert(nav.includes("isNavActive"), "Longest-prefix nav matching missing");
  });
  await check(2, "Nav hides staff/admin items by role", () => {
    const nav = read("lib/nav.ts");
    assert(nav.includes("staffOnly") && nav.includes("adminOnly"), "Role flags missing");
    assert(nav.includes("visibleNav"), "visibleNav helper missing");
    assert(nav.includes("/users") && nav.includes("adminOnly"), "Team is not admin-only");
    assert(nav.includes("/settings") && nav.includes("adminOnly"), "Settings is not admin-only");
    assert(nav.includes("/merchants") && nav.includes("staffOnly"), "Merchants is not staff-only");
  });
  await check(2, "Dashboard is role-aware", () => {
    const page = read("app/(app)/page.tsx");
    assert(page.includes("Store overview") && page.includes("Operations overview"), "Role titles missing");
    assert(page.includes("Available balance"), "Merchant wallet stats missing");
    assert(page.includes("Needs attention"), "Attention queue missing");
    const dash = read("lib/dashboard.ts");
    assert(dash.includes("availableBalance") && dash.includes("pendingApplications"), "Scoped dashboard queries missing");
  });
  await check(2, "Login screen is Harbor-branded", () => {
    const login = read("app/login/page.tsx");
    assert(login.includes("Harbor"), "Login missing Harbor name");
    assert(!/tiktok/i.test(login), "Login still mentions TikTok");
    assert(login.includes("oscar.d@example.net"), "Demo admin hint missing");
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
      "app/(app)/merchants/applications/page.tsx",
      "app/(app)/merchants/plans/page.tsx",
    ];
    for (const file of pages) {
      assert(read(file).includes("isStaff"), `${file} is not staff-gated`);
    }
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
    assert(save.includes('session.role === "MERCHANT" ? session.merchantId'), "Merchant product scope missing");
    assert(read("app/(app)/categories/page.tsx").includes("isStaff"), "Categories not staff-gated");
    assert(read("app/(app)/customers/page.tsx").includes("isStaff"), "Customers not staff-gated");
  });
}

async function phase5Database(prisma) {
  await check(5, "Seed has products, categories, reviews, customers", async () => {
    const products = await prisma.product.count();
    const categories = await prisma.category.count();
    const reviews = await prisma.review.count();
    const customers = await prisma.customer.count();
    assert(products >= 10, `Only ${products} products`);
    assert(categories >= 6, `Only ${categories} categories`);
    assert(reviews >= 5, `Only ${reviews} reviews`);
    assert(customers >= 8, `Only ${customers} customers`);
  });
  await check(5, "Merchant scoping helper forces store id", () => {
    const scope = read("lib/scope.ts");
    assert(scope.includes("merchantId: session.merchantId"), "merchantScope does not pin store id");
    assert(scope.includes("canAccessMerchant"), "canAccessMerchant missing");
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
      "app/(app)/settings/page.tsx",
      "lib/actions/payouts.ts",
      "lib/actions/users.ts",
    ]) {
      assert(exists(file), `Missing ${file}`);
    }
    assert(read("app/(app)/users/page.tsx").includes("canManageTeam"), "Users not admin-gated");
    assert(read("app/(app)/settings/page.tsx").includes("SUPER_ADMIN"), "Settings not admin-gated");
    const payouts = read("lib/actions/payouts.ts");
    assert(payouts.includes("availableBalance"), "Payout does not touch available balance");
    assert(payouts.includes("Amount exceeds available balance"), "Overdraw guard missing");
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
}

// ---------------------------------------------------------------------------
// Phase 7 static
// ---------------------------------------------------------------------------
async function phase7Static() {
  console.log("\nPhase 7 — Hosting and preview");
  await check(7, "start script bootstraps DB and binds PORT", () => {
    const pkg = JSON.parse(read("package.json"));
    assert(pkg.scripts.start.includes("scripts/bootstrap.mjs"), "start does not bootstrap");
    assert(pkg.scripts.start.includes("0.0.0.0"), "start does not bind all interfaces");
    assert(pkg.scripts.start.includes("PORT"), "start ignores PORT");
    const boot = read("scripts/bootstrap.mjs");
    assert(
      boot.includes("prisma") && boot.includes("dev.db"),
      "bootstrap looks in the wrong place for SQLite",
    );
    assert(boot.includes("prisma/seed.ts") || boot.includes("seed.ts"), "bootstrap does not seed");
  });
  await check(7, "Preview hosts are allowed for Server Actions", () => {
    const config = read("next.config.ts");
    assert(config.includes("allowedDevOrigins"), "allowedDevOrigins missing");
    assert(config.includes("*.agent.cvm.dev"), "agent.cvm.dev origin missing");
    assert(config.includes("*.cursorvm.com"), "cursorvm.com origin missing");
    assert(config.includes("allowedOrigins"), "serverActions.allowedOrigins missing");
  });
  await check(7, "README documents Hostinger Node hosting, not PHP public_html", () => {
    const readme = read("README.md");
    assert(readme.includes("Hostinger"), "Hostinger section missing");
    assert(/not run as a normal PHP site|public_html/.test(readme), "PHP warning missing");
    assert(readme.includes("AUTH_SECRET"), "AUTH_SECRET warning missing");
    assert(exists("PROJECT_PLAN.md"), "PROJECT_PLAN.md missing");
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
    assert(locationPath(res) === "/login", `Redirected to ${locationPath(res)}`);
  });
  await check(2, "Login HTML is Harbor, not a marketplace clone", async () => {
    const { res, text } = await pageText("/login");
    assert(res.status === 200, `/login ${res.status}`);
    assert(/Harbor/.test(text), "Login HTML missing Harbor");
    assert(!/tiktok/i.test(text), "Login HTML mentions TikTok");
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
  ];
  await check(7, "Super admin can open every operations route", async () => {
    for (const pathname of [...staffRoutes, "/users", "/settings"]) {
      const res = await getWithCookie(pathname, adminCookie);
      assert(res.status === 200, `${pathname} returned ${res.status} for admin`);
    }
  });
  await check(2, "Ops can open staff pages but not Team or Settings", async () => {
    for (const pathname of staffRoutes) {
      const res = await getWithCookie(pathname, opsCookie);
      assert(res.status === 200, `${pathname} returned ${res.status} for ops`);
    }
    for (const pathname of ["/users", "/settings"]) {
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
    assert(text.includes("Needs attention"), "Admin attention queue missing");
  });
  await check(2, "Ops dashboard HTML omits Team and Settings", async () => {
    const { text } = await pageText("/", opsCookie);
    assert(text.includes("Operations overview"), "Ops dashboard title missing");
    assert(hasHref(text, "/merchants"), "Ops nav missing Merchants");
    assert(!hasHref(text, "/users"), "Ops nav leaked Team");
    assert(!hasHref(text, "/settings"), "Ops nav leaked Settings");
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
  ];
  const merchantBlocked = [
    "/merchants",
    "/merchants/applications",
    "/merchants/plans",
    "/customers",
    "/categories",
    "/users",
    "/settings",
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
    assert(!hasHref(text, "/merchants"), "Merchant nav leaked Merchants");
    assert(!hasHref(text, "/merchants/applications"), "Merchant nav leaked Applications");
    assert(!hasHref(text, "/customers"), "Merchant nav leaked Customers");
    assert(!hasHref(text, "/categories"), "Merchant nav leaked Categories");
    assert(!hasHref(text, "/users"), "Merchant nav leaked Team");
    assert(!hasHref(text, "/settings"), "Merchant nav leaked Settings");
  });

  await check(3, "Merchant /orders HTML is scoped to Northline Outfitters", async () => {
    const { res, text } = await pageText("/orders", merchantCookie);
    assert(res.status === 200, `/orders ${res.status}`);
    assert(text.includes("Northline Outfitters"), "Merchant orders missing own store");
    assert(!text.includes("Cedar &amp; Co") && !text.includes("Cedar & Co. Home"), "Merchant orders leaked Cedar & Co.");
    assert(!text.includes("Lumen Beauty"), "Merchant orders leaked Lumen Beauty");
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
  await check(5, "Merchant /products HTML is store-scoped", async () => {
    const { text } = await pageText("/products", merchantCookie);
    assert(text.includes("Trail Fleece") || text.includes("Alpine Daypack") || text.includes("Merino"), "Northline products missing");
    assert(!text.includes("Vitamin C Serum"), "Merchant products leaked Lumen catalog");
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
  console.log("Harbor Commerce OS — phase verification");
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
