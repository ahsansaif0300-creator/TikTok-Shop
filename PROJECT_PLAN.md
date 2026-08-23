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

- [ ] Super admin sees Team and Settings
- [ ] Ops does **not** see Team or Settings
- [ ] Merchant does **not** see Merchants, Applications, Plans, Customers, Categories, Team, Settings
- [ ] Dashboard numbers are scoped for merchants (`lib/scope.ts`)
- [ ] Unread notification count appears in the shell

### Verify

`npm run verify` (nav + seed notifications) and `npm run verify:http` (HTML for each role).

---

## Phase 3 — Orders, shipping, refunds

**Goal:** A real order can be paid, packed, shipped with tracking, delivered, settled, refunded.

### Lifecycle

`PENDING_PAYMENT` → `PAID` → `PROCESSING` → `SHIPPED` → `DELIVERED` → `COMPLETED`

Cancel is allowed through `PROCESSING`. `PAID` credits **pending** profit. `COMPLETED` moves that profit to **available**.

### Deliverables

- `/orders` list + `/orders/[id]` detail
- Status changes in `lib/actions/orders.ts` with audit log
- Ship form: carrier + tracking number → `SHIPPED` + `Shipment`
- `/shipping` shipment board
- Refund types: refund only, return & refund, exchange
- Staff approve/reject; optional restock; ledger `REFUND`

### Checklist

- [ ] Seed includes every order status
- [ ] Seed includes carriers (UPS, FedEx, USPS) and shipments
- [ ] Seed includes pending and resolved refunds
- [ ] Illegal status jumps are rejected
- [ ] Shipping an order writes tracking and sets `SHIPPED`
- [ ] Completing an order moves pending → available
- [ ] Approving a restock refund increases product stock
- [ ] Merchant can only see/change their own orders

### Verify

`npm run verify` runs an isolated lifecycle against SQLite. `npm run verify:http` loads `/orders`, `/shipping`, `/refunds`.

---

## Phase 4 — Merchants, applications, plans

**Goal:** Ops can onboard sellers, assign SaaS plans, activate or suspend stores.

### Deliverables

- `/merchants` list + `/merchants/[id]`
- `/merchants/applications` approve (creates merchant on Starter) / reject
- `/merchants/plans` monthly fee + sales commission + product cap
- Staff-only pages and actions

### Checklist

- [ ] Seed has ACTIVE, PENDING, and SUSPENDED merchants
- [ ] At least one pending application
- [ ] Plans Starter / Growth / Scale exist
- [ ] Merchant role is redirected away from these routes
- [ ] Approving an application creates an `ACTIVE` merchant

### Verify

`npm run verify` (seed + approve-application dry run) and HTTP redirects for the merchant role.

---

## Phase 5 — Catalog, customers, reviews

**Goal:** Sellers manage products; staff manage categories and see shoppers.

### Deliverables

- `/products` and `/products/[id]` (including `new`)
- `/categories` staff-only
- `/reviews`
- `/customers` and `/customers/[id]` staff-only
- `saveProduct` forces merchantId for `MERCHANT` sessions

### Checklist

- [ ] Seed has products, categories, reviews, customers
- [ ] Merchant product saves cannot target another store
- [ ] Categories and customers routes redirect merchants home
- [ ] Low-stock products appear on the dashboard

### Verify

`npm run verify` + HTTP product/customer routes.

---

## Phase 6 — Finance and workspace

**Goal:** Balances come from sales; payouts go to a bank; staff can run the workspace.

### Deliverables

- `/finance` ledger (`SALE`, `REFUND`, `FEE`, `PAYOUT`, `ADJUSTMENT`)
- `/finance/payouts` request → approve/reject → mark paid (decrements available)
- `/notifications`
- `/users` super-admin only (invite OPS / SUPER_ADMIN)
- `/profile` name + password
- `/settings` super-admin only (store name, support, currency)

### Checklist

- [ ] Seed has ledger rows and payouts in PAID / PENDING / APPROVED
- [ ] Paying a payout decrements `availableBalance` and writes a PAYOUT ledger row
- [ ] Requesting more than available balance is rejected
- [ ] Ops cannot open `/users` or `/settings`
- [ ] Merchant payouts are scoped to their store

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
