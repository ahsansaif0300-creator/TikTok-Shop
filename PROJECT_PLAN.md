# Harbor Commerce OS — phase plan

This is the working plan for the legitimate multi-merchant operations dashboard. Each phase has a checklist. Run `npm run verify` after setup; it checks Phases 1–6 against the database and source. Run `npm run verify:http` while the app is listening to check routes and role scoping.

Product name: **Harbor Commerce OS**. Sidebar: Harbor / Commerce OS. Accent: teal `#0f7a6c`. Dark sidebar: `#161310`.

## Rules that never ship

These are not “later phases.” They are out of scope:

- No TikTok (or any marketplace) name, logo, or impersonation
- No virtual/auto orders, fake GMV, fake clicks, or fake sales counters
- No crypto / blockchain recharge or withdraw
- No MLM, invite pyramids, or invitation commissions
- No Yu’ebao, loans, or withdrawal-lock traps

If a phase checklist would require any of the above, the phase is wrong — do not implement it.

---

## Phase 1 — Foundation

**Goal:** App boots, schema exists, three demo roles can authenticate.

### Deliverables

- Next.js App Router + TypeScript + Tailwind + Prisma + SQLite
- `.env.example` with `DATABASE_URL`, `AUTH_SECRET`, `PORT`
- `prisma/schema.prisma` with roles, merchants, orders, refunds, shipments, payouts, ledger
- JWT cookie session `harbor_session` (`lib/auth.ts`)
- `proxy.ts` sends anonymous users to `/login`
- Seeded accounts:
  - Super admin `oscar.d@example.net` / `HarborAdmin!2026`
  - Ops `sarah.b@example.net` / `HarborOps!2026`
  - Merchant Northline Outfitters `iris.p@example.org` / `HarborMerchant!2026`
- Scripts: `setup`, `db:seed`, `db:reset`, `start` via `scripts/bootstrap.mjs`

### Checklist

- [x] `cp .env.example .env` then `npm install` and `npm run setup` succeed
- [x] SQLite file exists at `prisma/dev.db`
- [x] Three users exist with roles `SUPER_ADMIN`, `OPS`, `MERCHANT`
- [x] Merchant user is linked to Northline Outfitters
- [x] Passwords verify with bcrypt
- [x] `GET /` without a cookie redirects to `/login`
- [x] Valid login lands on the dashboard
- [x] Source does not contain TikTok branding or MLM/crypto models

### Verify

```bash
npm run setup
npm run verify
```

---

## Phase 2 — Shell and dashboard

**Goal:** Signed-in users get a role-aware workspace and a real overview.

### Deliverables

- `components/shell.tsx` + `components/workspace-chrome.tsx` — Harbor mark, role, store context, mobile menu, logout
- `lib/nav.ts` — nav groups; `staffOnly` / `adminOnly` filters; longest-prefix active item
- Dashboard `/` with GMV, orders, 14-day chart, low stock, needs-attention queue
- Merchant dashboard shows available/pending balances; staff sees active merchants and payouts
- Login screen with Harbor copy (not a marketplace clone)

### Checklist

- [x] Super admin sees Team and Settings
- [x] Ops does **not** see Team or Settings
- [x] Merchant does **not** see Merchants, Applications, Plans, Customers, Categories, Team, Settings
- [x] Dashboard numbers are scoped for merchants (`lib/scope.ts`)
- [x] Unread notification count appears in the shell
- [x] Header shows store name for merchants and “All merchants” for staff
- [x] Mobile menu opens the same role-filtered nav

### Verify

`npm run verify` (nav + seed notifications) and `npm run verify:http` (HTML for each role).

---

## Phase 3 — Orders, shipping, refunds

**Goal:** A real order can be paid, packed, shipped with tracking, delivered, settled, refunded.

### Lifecycle

`PENDING_PAYMENT` → `PAID` → `PROCESSING` → `SHIPPED` → `DELIVERED` → `COMPLETED`

Cancel is allowed through `PROCESSING`. `PAID` credits **pending** profit. `COMPLETED` moves that profit to **available**.

### Deliverables

- `/orders` list + `/orders/[id]` detail with lifecycle timestamps and audit
- Shared transitions in `lib/order-flow.ts` (shipped only via carrier + tracking)
- Cancel after payment reverses pending profit
- Ship form: carrier + tracking number → `SHIPPED` + `Shipment`
- `/shipping` ready-to-ship queue + tracking links
- Refund types: refund only, return & refund, exchange; amount + optional restock
- Staff approve/reject; restock; ledger `REFUND`

### Checklist

- [x] Seed includes every order status
- [x] Seed includes carriers (UPS, FedEx, USPS) and shipments
- [x] Seed includes pending and resolved refunds
- [x] Illegal status jumps are rejected
- [x] Shipping an order writes tracking and sets `SHIPPED`
- [x] Completing an order moves pending → available
- [x] Approving a restock refund increases product stock
- [x] Merchant can only see/change their own orders
- [x] Cancel after payment reverses pending profit
- [x] Ready-to-ship queue lists paid/processing orders without tracking

### Verify

`npm run verify` runs an isolated lifecycle against SQLite. `npm run verify:http` loads `/orders`, `/shipping`, `/refunds`.

---

## Phase 4 — Merchants, applications, plans

**Goal:** Ops can onboard sellers, assign SaaS plans, activate or suspend stores.

### Deliverables

- `/merchants` list + `/merchants/[id]` (activate/suspend, plan, catalog cap, ledger)
- `/merchants/applications` staff intake + approve (creates merchant on Starter) / reject
- `/merchants/plans` monthly fee + sales commission + product cap + stores on each plan
- Staff-only pages and actions (audited)

### Checklist

- [x] Seed has ACTIVE, PENDING, and SUSPENDED merchants
- [x] At least one pending application
- [x] Plans Starter / Growth / Scale exist
- [x] Merchant role is redirected away from these routes
- [x] Approving an application creates an `ACTIVE` merchant
- [x] Rejecting an application does not create a merchant
- [x] Staff can log an inbound application

### Verify

`npm run verify` (seed + approve-application dry run) and HTTP redirects for the merchant role.

---

## Phase 5 — Catalog, customers, reviews

**Goal:** Sellers manage products; staff manage categories and see shoppers.

### Deliverables

- `/products` and `/products/[id]` (including `new`), with low-stock filter
- Plan product cap and unique SKU enforced on save; merchantId cannot be spoofed
- `/categories` staff-only
- `/reviews` store-scoped
- `/customers` and `/customers/[id]` staff-only

### Checklist

- [x] Seed has products, categories, reviews, customers
- [x] Merchant product saves cannot target another store
- [x] Categories and customers routes redirect merchants home
- [x] Low-stock products appear on the dashboard
- [x] Plan product cap is enforced on create
- [x] Merchant cannot open another store’s product

### Verify

`npm run verify` + HTTP product/customer routes.

---

## Phase 6 — Finance and workspace

**Goal:** Balances come from sales; payouts go to a bank; staff can run the workspace.

### Deliverables

- `/finance` ledger (`SALE`, `REFUND`, `FEE`, `PAYOUT`, `ADJUSTMENT`) with type filters
- `/finance/payouts` request → approve/reject → mark paid (decrements available; no double-pay or overdraw)
- `/notifications`
- `/users` super-admin only (invite OPS / SUPER_ADMIN; unique email, password length)
- `/profile` name + password (min 8 chars)
- `/settings` super-admin only (store name, support, currency)

### Checklist

- [x] Seed has ledger rows and payouts in PAID / PENDING / APPROVED
- [x] Paying a payout decrements `availableBalance` and writes a PAYOUT ledger row
- [x] Requesting more than available balance is rejected
- [x] Ops cannot open `/users` or `/settings`
- [x] Merchant payouts are scoped to their store
- [x] Pending payouts cannot skip straight to paid; paid payouts cannot be paid twice

### Verify

`npm run verify` payout lifecycle + HTTP finance/workspace routes.

---

## Phase 7 — Hosting, preview, and release bar

**Goal:** The app can run on Hostinger Node (or a VPS) and in Cursor preview.

### Deliverables

- `npm run start` bootstraps SQLite if missing, binds `0.0.0.0:${PORT:-3000}`
- `next.config.ts` allows Cursor preview hosts for Server Actions
- README Hostinger (Business/Cloud Node app or VPS) — not PHP `public_html`
- `npm run lint` and `npm run build` succeed
- `npm run verify` and `npm run verify:http` succeed

### Checklist

- [ ] Production server returns `/login` over HTTP
- [ ] Authenticated roles can load their allowed pages
- [ ] Merchant HTML for `/orders` does not list other stores’ names as sellers
- [ ] Cursor preview: `allowedDevOrigins` / `serverActions.allowedOrigins` include `*.agent.cvm.dev` and `*.cursorvm.com`
- [ ] README states Node hosting, SSL, and `AUTH_SECRET` rotation
- [ ] No impersonation branding in the UI

### Verify

```bash
npm run lint
npm run build
npm run start
# in another shell:
npm run verify:http
```

Cursor preview still needs a **network token from the agent Ports UI**. The app cannot mint that token.

---

## Demo accounts (all phases)

| Role | Email | Password |
| --- | --- | --- |
| Super admin | oscar.d@example.net | HarborAdmin!2026 |
| Operations | sarah.b@example.net | HarborOps!2026 |
| Merchant (Northline Outfitters) | iris.p@example.org | HarborMerchant!2026 |

Change `AUTH_SECRET` and these passwords before inviting real users.

---

## How verification is wired

| Command | What it covers |
| --- | --- |
| `npm run setup` | Prisma client, schema push, seed |
| `npm run verify` | Phases 1–6: files, forbidden product, seed, order/refund/payout/application lifecycle |
| `npm run verify:http` | Phase 2–7 routes, auth redirects, role HTML |
| `npm run lint` | ESLint |
| `npm run build` | Production compile |
| `npm run start` | Phase 7 process (bootstrap + Next) |

A phase is **done** only when its checklist items pass in `npm run verify` (and HTTP items in `npm run verify:http` when a server is up). Do not mark a later phase done if an earlier phase fails.
