# Harbor Commerce OS

A professional multi-merchant commerce operations dashboard. It covers the legitimate parts of a seller-center style admin — orders, catalog, onboarding, refunds, shipping, and bank payouts — without marketplace impersonation, fake orders, or MLM mechanics.

## What you get

- **Roles:** Super admin, operations staff, and merchant (store-scoped)
- **Orders:** Payment → processing → shipment (carrier + tracking) → delivery → settlement
- **Refunds:** Refund only, return & refund, or exchange, with optional restock
- **Merchants:** Applications, activate/suspend, SaaS-style seller plans (monthly fee + sales commission)
- **Catalog:** Products, categories, stock, reviews
- **Customers:** Profiles and order history
- **Finance:** Ledger from real sales, available vs pending balance, bank payouts
- **Workspace:** Team users, profile, settings, notifications, audit-ready status changes

Intentionally **not** included: branded impersonation, virtual/auto orders, crypto rails, invitation pyramids, withdrawal locks, fake sales counters, or loan/savings gimmicks.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Super admin | `oscar.d@example.net` | `HarborAdmin!2026` |
| Operations | `sarah.b@example.net` | `HarborOps!2026` |
| Merchant (Northline Outfitters) | `iris.p@example.org` | `HarborMerchant!2026` |

## Setup

```bash
cp .env.example .env
npm install
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run setup` generates the Prisma client, creates the SQLite database, and loads demo merchants, products, orders, refunds, and payouts.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Prisma, SQLite.

Change `AUTH_SECRET` before any real deployment. This workspace is a product foundation, not a production marketplace with checkout or tax filing.
