# How to use Harbor Commerce OS

This is the day-to-day guide after the app is installed. It is an **operations dashboard** for real merchants, orders, refunds, and bank payouts — not a customer storefront and not a marketplace clone.

## 1. Run it on your computer

1. Copy env defaults and set a secret:

   ```bash
   cp .env.example .env
   ```

   Open `.env` and replace `AUTH_SECRET` with a long random string. Keep `PORT=3000` unless that port is taken.

2. Install and seed demo data:

   ```bash
   npm install
   npm run setup
   ```

3. Start in development:

   ```bash
   npm run dev
   ```

   Open **http://localhost:3000/login** on this computer. That address does **not** work on a phone or another PC — see [Open from your phone or another device](#open-from-your-phone-or-another-device) below.

4. Or run the production build (same process Hostinger uses):

   ```bash
   npm run build
   npm run start
   ```

   `npm run start` creates `prisma/dev.db` and demo accounts if the database file is missing, then binds `0.0.0.0` on `PORT` (default 3000).

   If you log in over **plain HTTP** (local `next start`), add this to `.env` so the browser keeps the session cookie:

   ```
   AUTH_COOKIE_SECURE=false
   ```

   Leave that unset when the site is served as **HTTPS**.

## Open from your phone or another device

`http://localhost:3000` means “this device.” On a phone or another computer it tries to open a server **on that phone/computer**, which is why you see **connection refused** / **site not reachable**.

### Same Wi‑Fi as your computer (home/office)

1. Keep the app running on your computer (`npm run dev` or `npm run start`). Leave that window open.
2. On the computer, run:

   ```bash
   npm run urls
   ```

   It prints a line like `On your phone/Wi-Fi: http://192.168.1.23:3000/login`.
   Or look it up yourself:
   - **Windows:** Command Prompt → `ipconfig` → **IPv4 Address** (often `192.168.x.x` or `10.x.x.x`)
   - **Mac:** Terminal → `ipconfig getifaddr en0`
   - **Linux:** `hostname -I`
3. On the phone, join the **same Wi‑Fi** (not mobile data).
4. In the phone browser open `http://YOUR-COMPUTER-IP:3000/login` — for example `http://192.168.1.23:3000/login`. Do not type `localhost`.
5. If login does not stick, add `AUTH_COOKIE_SECURE=false` to `.env` and restart.
6. If it still refuses to connect:
   - Windows Firewall: allow **Node.js** (or port **3000**) on a **Private** network
   - Confirm both devices are on the same Wi‑Fi, not guest/AP isolation
   - Confirm the computer did not sleep and the terminal is still running the app

### Cursor Cloud / a localhost link from the agent

A Cloud Agent `localhost` link is only forwarded to **your** Cursor session. Other phones and PCs cannot open it.

Use one of these instead:

- Run the app **on your own computer** and use the Wi‑Fi IP steps above
- In the agent **Ports** panel, expose port **3000** and copy the **public preview URL** (that URL needs the Ports network token; the app cannot create it)
- Deploy to Hostinger and use `https://your-domain.com/login`

### Anyone on the internet

Use your Hostinger / VPS domain (section 5). Do not try to share `localhost`.

## 2. Sign in

Demo passwords are for local/preview only. Change them under **Profile** before anyone else uses the app.

| Who you are | Email | Password | What you see |
| --- | --- | --- | --- |
| Super admin | `oscar.d@example.net` | `HarborAdmin!2026` | Every store, Team, Settings |
| Operations | `sarah.b@example.net` | `HarborOps!2026` | Every store, no Team/Settings |
| Merchant | `iris.p@example.org` | `HarborMerchant!2026` | Northline Outfitters only |

After login you land on the dashboard. Use the sidebar (or **Open menu** on a phone).

## 3. Daily loop for operations staff

Use admin or ops.

1. **Applications** (`/merchants/applications`)  
   Review inbound seller applications. Approve or reject explicitly. Approved merchants can then be activated.

2. **Merchants** (`/merchants`)  
   Open a store to activate, suspend, or assign a seller plan (SKU cap + commission).

3. **Orders** (`/orders`)  
   Open an order and move it in order:  
   **Pay → Process → Ship (carrier + tracking required) → Deliver → Settle**.  
   You cannot skip ship. Cancel on a paid-but-unshipped order reverses the pending balance.

4. **Shipping** (`/shipping`)  
   Same shipment step, focused on labels/tracking.

5. **Refunds** (`/refunds`)  
   Staff only can approve. Types: refund only, return & refund, or exchange. Restock when the goods actually came back.

6. **Payouts** (`/finance/payouts`)  
   Merchant requests → staff **Approve** → staff **Mark paid**.  
   You cannot mark paid while still pending, and you cannot pay more than available balance.

7. **Ledger** (`/finance`)  
   Filter by store and entry type. Available vs pending comes from real sales, not a fake counter.

8. **Catalog / customers / reviews**  
   Products, stock, categories (staff), shopper profiles, and review moderation.

9. **Team** (admin only, `/users`)  
   Create staff or merchant users with a real email and a strong password. Merchant users must be tied to a store.

## 4. Daily loop for a merchant

Sign in as the Northline account (or any `MERCHANT` user).

1. **Dashboard** — your store’s orders, low stock, and available balance.  
2. **Products** — add SKUs. Your plan caps how many you can list; SKUs must be unique.  
3. **Orders / Shipping** — pay, process, ship with tracking, deliver. You only see your store.  
4. **Refunds** — request a refund; staff decides it.  
5. **Ledger / Payouts** — request a bank payout against available balance (destination last4). Wait for ops to approve and mark paid.  
6. **Profile** — change your name and password.

You cannot open other stores, Team, Settings, global customers, or categories.

## Make a shop from the admin panel

Sign in as **oscar.d@example.net**. Shops in Harbor are **Merchants**.

1. **Applications** → fill **Log inbound seller** (business name, contact, email, country, category) → **Save application**.
2. On that row click **Approve**. Harbor creates an ACTIVE store on the Starter plan.
3. Open **Merchants** → click the store → **Activate** if needed, assign a **Seller plan**.
4. On the same page, **Create store login** (email + password 8+ characters). Give those credentials to the seller.
5. The seller signs in at `/login` and only sees that shop (products, orders, shipping, payouts).
6. You manage everyone from **Orders**, **Refunds**, **Shipping**, **Ledger**, and **Payouts**.

Demo shop already there: Northline Outfitters (`iris.p@example.org` / `HarborMerchant!2026`).

## 5. Put it on Hostinger (temporary domain, no custom domain)

Follow **[`HOSTINGER.md`](./HOSTINGER.md)**. Paste **[`hostinger.env.example`](./hostinger.env.example)** into hPanel Environment variables.

Short version:

1. Plan must be **Business** or **Cloud** (Node.js web app).
2. **Websites** → **Add Website** → **Node.js web app** → **Free subdomain**.
3. Import GitHub branch `main` (repo root has `package.json`), or upload `npm run pack:hostinger`’s zip.
4. Start command `npm run start`. Env: `DATABASE_URL=file:./dev.db` and a new `AUTH_SECRET`.
5. Open `https://YOUR-TEMP.hostingersite.com/login`.

Do not copy the project into `public_html`.

### VPS (better for real data)

Install Node 20+, clone the repo, set `.env`, then:

```bash
npm install
npm run setup
npm run build
PORT=3000 npm run start
```

Put Nginx + Let’s Encrypt in front of port 3000 (or use PM2 as in the README). Rotate `AUTH_SECRET` and demo passwords before inviting real users.

## 6. What this product does not do

- Customer-facing checkout / cart
- Tax filing or invoicing as a legal product
- TikTok or other marketplace branding
- Fake/virtual orders, crypto, MLM, or locked withdrawals

Orders in the demo were seeded so you can click through the flow. In production you would ingest real orders from your own storefront or integration — that connector is not in this repo.

## 7. Checks before you call it “ready”

```bash
npm run verify
npm run lint
npm run build
npm run start          # leave this running
# another terminal:
npm run verify:http
```

Cursor preview still needs a **network token from the agent Ports UI**. The app cannot mint that token.
