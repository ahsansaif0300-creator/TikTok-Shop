# Harbor Commerce OS

A professional multi-merchant commerce operations dashboard. It covers the legitimate parts of a seller-center style admin — orders, catalog, onboarding, refunds, shipping, and bank payouts — without marketplace impersonation, fake orders, or MLM mechanics.

**Day-to-day usage (local, roles, ops loop, Hostinger):** see [`USAGE.md`](./USAGE.md).

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

Open [http://localhost:3000/login](http://localhost:3000/login) **on this computer**.

Phones and other PCs cannot use `localhost` — they must use this computer’s Wi‑Fi IP (`npm run urls`) or a Hostinger domain. Details: [`USAGE.md`](./USAGE.md#open-from-your-phone-or-another-device).

`npm run setup` generates the Prisma client, creates the SQLite database, and loads demo merchants, products, orders, refunds, and payouts.

Requires **Node.js 20 or newer**.

## Phases and verification

Work is split into seven phases in [`PROJECT_PLAN.md`](./PROJECT_PLAN.md). After setup:

```bash
npm run verify        # files, seed, order/refund/payout lifecycle
npm run lint
npm run build
npm run dev           # or: npm run start
# in another terminal, with the app listening:
npm run verify:http   # login wall, role routes, merchant scoping
```

A phase is done only when its checklist in `PROJECT_PLAN.md` passes those commands.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Prisma, SQLite.

Change `AUTH_SECRET` before any real deployment. This workspace is a product foundation, not a production marketplace with checkout or tax filing.

## Put it on Hostinger (temporary domain is enough)

This is a **Node.js / Next.js** app. It will not run as a normal PHP site in `public_html`. You need a Hostinger plan that can run Node:

- **Easiest:** Business Web Hosting or Cloud (Node.js web app in hPanel)
- **More control:** VPS (you SSH in, install Node, run the app yourself)

Premium/shared PHP-only plans are not enough.

**No custom domain required.** Use Hostinger’s free URL (`something.hostingersite.com`). Full click-by-click steps and the env file to paste: [`HOSTINGER.md`](./HOSTINGER.md) and [`hostinger.env.example`](./hostinger.env.example).

### 1. Temporary domain (or your own later)

1. In hPanel: **Websites** → **Add Website** → **Node.js web app**.
2. When asked for a domain, choose **Free subdomain** / **Use temporary domain**.
3. Hostinger gives you `https://….hostingersite.com`. Open `/login` on that URL after deploy.
4. Turn on **SSL** in hPanel if the padlock is missing.

If you later buy a domain: **Domains** → **Add domain** → set it primary. You do not need to put the domain in the source code.

### 2. Deploy as a Node.js web app (Business / Cloud)

1. Push this repo to GitHub (the Harbor branch is fine).
2. In hPanel: **Websites** → **Add Website** → **Node.js web app**.
3. If that domain already has a PHP/WordPress site, Hostinger wants you to **remove that website slot first** (download a backup). Then add the Node app on the same domain.
4. Choose **Import Git repository**, connect GitHub, pick this repo and branch **`main`** (that branch has `package.json` at the root).
5. Suggested settings:
   - Framework: **Next.js**
   - Node.js: **20** or **22**
   - Install: `npm ci`
   - Build: `npm run build`
   - Start: `npm run start`
6. Paste [`hostinger.env.example`](./hostinger.env.example) into **Environment variables**. Replace `AUTH_SECRET` with a long random string (`openssl rand -base64 32`).

Do not reuse the local example secret. Session cookies are **Secure** on HTTPS (the temporary domain uses SSL).

7. Deploy. The first start creates the SQLite database and demo accounts if the DB file is missing.
8. Open `https://YOUR-TEMP-DOMAIN.hostingersite.com/login`.

Redeploys can wipe SQLite because it lives in the app folder. For a real shop, use a VPS disk or a hosted Postgres database so orders are not reset.

Optional ZIP instead of Git: `npm run pack:hostinger`, then upload `harbor-hostinger.zip` (still not `public_html`).

### 3. Deploy on a Hostinger VPS (recommended if you will keep live data)

SSH in, then:

```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
git clone https://github.com/YOUR_USER/YOUR_REPO.git /var/www/harbor
cd /var/www/harbor
cp .env.example .env
# edit .env and set a strong AUTH_SECRET
npm install
npm run setup
npm run build
sudo npm install -g pm2
PORT=3000 pm2 start npm --name harbor -- start
pm2 save
pm2 startup
```

Put Nginx in front of port 3000 and issue SSL with Certbot for your domain. Hostinger’s VPS docs cover Nginx + Let’s Encrypt.

### Daily use

Follow [`USAGE.md`](./USAGE.md). Short version:

1. Visit `https://your-domain.com/login`
2. Sign in with a demo account (or change the admin password under **Profile**)
3. Admin/ops see all merchants, orders, refunds, payouts
4. The merchant account only sees Northline Outfitters data

Change `AUTH_SECRET` and the demo passwords before you invite anyone.
