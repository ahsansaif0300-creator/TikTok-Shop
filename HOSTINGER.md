# Go live on Hostinger with a temporary domain

## Failover if Hostinger suspended the site

Do **not** attach another domain to the same Hostinger website. That slot is frozen, so a new Namecheap domain pointed at Hostinger will stay dark.

**Fastest live URL (today):** Render’s free `https://….onrender.com` hostname. The client can use that immediately. Attach any new domain afterward.

Use the **Free** instance. Do **not** add a payment card. The old Blueprint used a paid disk; that is why Render asked for a card.

**If Render is asking for a card right now:** click Back / cancel. Do not enter a card.

**Then create a Free web service (clearest path):**

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service** (not Blueprint).
2. Connect GitHub `TikTok-Shop`.
3. Branch: **`cursor/tikitok-rebrand-host-7442`**.
4. Runtime **Node**. Build `npm ci && npm run build`. Start `npm run start`.
5. Instance type: **Free**.
6. Environment: `DATABASE_URL=file:./prisma/dev.db`, `AUTH_COOKIE_SECURE=true`, `AUTH_SECRET` = any long random string, `APP_BASE_URL` = leave blank until you have the URL.
7. Create Web Service. Wait until **Live**.
8. Copy `https://….onrender.com`, put that in `APP_BASE_URL`, Manual Deploy.
9. Open `/welcome` and send the client that URL.

Free instances sleep after ~15 minutes and the demo SQLite can reset on a new deploy. That is fine for getting the client a live link today.

**Or retry Blueprint** after this `render.yaml` (plan `free`, no disk) is on the same branch, then click Retry. If it still demands a card, use Web Service → Free above.

**Then attach another domain** (Namecheap → the new name):

1. In Render → **Settings** → **Custom Domains** → add `yournewdomain.com` and `www.yournewdomain.com`.
2. In Namecheap → **Advanced DNS** add the A / CNAME records Render shows. Do **not** keep `hermes.dns-parking.com` / `artemis.dns-parking.com` if this site is no longer on Hostinger.
3. Change `APP_BASE_URL` to `https://yournewdomain.com` and redeploy.

Railway works the same way (`railway.toml`). Add a volume mounted at `/data` and set `DATABASE_URL=file:/data/harbor-commerce.sqlite`, `HARBOR_DATA_DIR=/data`. Vercel serverless is a poor fit (no persistent SQLite disk).

---

Use this when you **do not have your own domain**. Hostinger gives you a free URL like:

```
https://something.hostingersite.com
```

This app is **Node.js / Next.js**. It will **not** run if you copy files into `public_html` like a PHP site.

## The files you use

| What | Where | What you do with it |
| --- | --- | --- |
| **GitHub repo** (best) | `ahsansaif0300-creator/TikTok-Shop` | Import in hPanel. Branch **`main`** (this is where `package.json` lives) |
| **`hostinger.env.example`** | repo root | Copy these two lines into hPanel **Environment variables**. Change `AUTH_SECRET` |
| **`harbor-hostinger.zip`** (optional) | created by `npm run pack:hostinger` | Only if you skip GitHub and upload an archive |
| **`package.json`** | repo root | Hostinger reads `build` / `start` from this. You do not upload it alone |

There is no `index.php` and no single file to drop in File Manager.

---

## Step by step (temporary domain)

### 1. Confirm the plan can run Node

In Hostinger hPanel you need **Business Web Hosting** or **Cloud** (Startup / Professional / Enterprise). PHP-only / Premium shared plans cannot run this app.

### 2. Add a Node.js website on a free subdomain

1. Log in to **hPanel**.
2. Open **Websites** → **Add Website**.
3. Choose **Node.js web app** (not WordPress, not PHP).
4. When asked for a domain, pick **Free subdomain** / **Use temporary domain**.
5. Hostinger generates an address such as `yourname.hostingersite.com`. Copy it. You will open `https://THAT-ADDRESS/welcome` when deploy finishes.

If that domain already has a PHP/WordPress site, Hostinger needs that website slot **removed** first (download a backup). Then add the Node app again.

### 3. Give Hostinger the project (pick one)

**Option A — GitHub (recommended)**

1. Choose **Import Git repository**.
2. Connect GitHub and allow the Hostinger GitHub App.
3. Repository: **`TikTok-Shop`** (`ahsansaif0300-creator/TikTok-Shop`).
4. Branch: **`main`**. Hostinger looks for `package.json` on this branch at the repo root.
5. Root directory: `.` (repo root, where `package.json` is).

**Option B — ZIP upload**

On your computer, in this project:

```bash
npm run pack:hostinger
```

That creates `harbor-hostinger.zip`. In hPanel choose **Upload your files** and upload that zip. Do not extract it into `public_html` yourself.

### 4. Build settings in the Hostinger form

Use these even if Hostinger auto-fills similar values:

| Field | Value |
| --- | --- |
| Framework | **Next.js** |
| Node.js version | **20** or **22** |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Start command | `npm run start` |
| Output directory | `.next` (if the form asks) |
| Entry file | leave empty, or `scripts/start.mjs` if required |

If Hostinger pre-fills `npm run start -- -p $PORT`, you can leave that. The start script already reads `PORT`.

### 5. Environment variables (use `hostinger.env.example`)

Open **`hostinger.env.example`**. In hPanel → your app → **Environment variables**, add:

```
DATABASE_URL=file:./dev.db
AUTH_SECRET=paste-a-long-random-string-here
APP_BASE_URL=https://YOUR-TEMP-DOMAIN.hostingersite.com
```

Create a secret on your computer:

```bash
openssl rand -base64 32
```

Paste that output as `AUTH_SECRET`. Do not use the example value from `.env.example`.

Do **not** set `AUTH_COOKIE_SECURE=false`. The temporary domain is HTTPS, so the login cookie should stay Secure.

Set `APP_BASE_URL` to the same URL people type in the browser (no trailing slash). TikTok Shop uses it when it prints a shop link such as `https://YOUR-TEMP-DOMAIN.hostingersite.com/s/northline-outfitters`.

After you attach a **custom domain**, change `APP_BASE_URL` to `https://yourdomain.com`. If you also add a wildcard DNS record (`*.yourdomain.com`) pointing at the same app, set `SHOP_BASE_DOMAIN=yourdomain.com` so each shop can be opened as `https://shop-slug.yourdomain.com`. Without wildcard DNS, keep using `/s/shop-slug` on the main domain.

### 6. Deploy

Click **Deploy**. Wait until the build is green and the process badge is **Running**.

A cache-clear or Restart alone used to keep the **old** `.next` folder, so phones still showed the previous signup page. `npm start` now rebuilds when app source is newer than that folder.

Still do this after GitHub updates:

1. Confirm hPanel uses branch **`main`** (not an old PR branch).
2. Click **Deploy** so Hostinger **pulls GitHub**. **Clear cache does not download new commits.** Restart also does not download new commits.
3. When the build is green, click **Restart**.
4. Open `/login/admin` with no `?error=setup`. Under the Login button you must see **Release tiktok-shop-login-always**. If you still see “packed demo database”, Hostinger is running the old build. Deploy **`main` again**. Do not click “Fix and redeploy” on an old snapshot.

The store Distribution Center (horizontal categories and product photos) only appears after **`main`** is deployed. Do not deploy an old PR branch snapshot.

First start creates SQLite and the demo accounts if `prisma/dev.db` is missing.

### 7. Open it

1. In the website dashboard, open the **temporary domain**.
2. Turn on **SSL** if the padlock is missing (**Security → SSL**).
3. Visit:

   `https://YOUR-TEMP-DOMAIN.hostingersite.com/welcome`

   Merchants can also open **Sign up** on that page, or a shop card at `/s/their-shop-slug`.

4. Sign in:

   | Role | Email | Password |
   | --- | --- | --- |
   | Super admin | `oscar.d@example.net` | `HarborAdmin!2026` |
   | Operations | `sarah.b@example.net` | `HarborOps!2026` |
   | Merchant | `iris.p@example.org` | `HarborMerchant!2026` |

Change these under **Profile** before you invite anyone.

### 8. If it fails

- **Build failed:** open **Deployments** and read the log. Node must be 20+.
- **TypeScript errors** (`Cannot find name 'isListedProduct'`, `implicit any` in `lib/ensure-db.ts`): that is an **old GitHub commit**. Latest **`main`** already imports `isListedProduct` and types the SQLite PRAGMA rows. In hPanel, Deploy **`main` again** (do not click “Fix and redeploy” on the failed old build). Then **Restart**. `npm run build` on current `main` completes TypeScript successfully.
- **Site not reachable / 403:** do not edit `public_html/.htaccess`. Redeploy so Hostinger regenerates it.
- **Build failed: GLIBC / SWC / next.config / hashed `*.next.config.mjs`:** Do **not** click **Fix and redeploy**. Latest **`main`** uses CommonJS `next.config.js` and `next build --webpack`. It does **not** delete Next’s temporary config files. Click **Close**, Deploy GitHub **`main`**, then **Restart**.
- **“TikTok Shop could not open the packed demo database”:** That sentence exists only on the **old** Hostinger build. GitHub `main` already removed it. **Clear cache does not install that GitHub commit.** In hPanel → Node.js app → **Deployments** → set branch **`main`** → click **Deploy** → wait until **Running** → **Restart**. Then open `https://tikitokshop.site/login/admin` with no `?error=setup`. You should see the current **Release** stamp under the Login button. Keep `AUTH_SECRET` set.
- **Hostinger email “suspended for phishing/mirroring”:** This is a Hostinger abuse hold, not an app crash. The live name used to say **TikTok Shop** with TikTok’s magenta/cyan colors, so their scanner treated `tikitokshop.site` as a copy of the official TikTok Shop. Latest **`main`** brands the product **TikiTok Shop**, uses different colors, and prints “Not affiliated with TikTok or ByteDance.” You cannot clear-cache this away. In hPanel open **Websites** → the suspended site → **Appeals / Contact** (or Hostinger chat) and say it is an independent seller-operations dashboard, not TikTok. Then Deploy **`main`** after they unsuspend. If they will not unsuspend, do **not** create a second Hostinger site with the same TikTok look. Use **Railway** or **Render** (Web Service + persistent disk) with `npm ci`, `npm run build`, `npm run start`, Node 20+, and the same env vars from `hostinger.env.example`. Point Namecheap nameservers at that new host, or use the Railway/Render URL until DNS is updated. Vercel serverless is a poor fit because this app keeps SQLite on disk.
- **App built but login loop:** confirm `AUTH_SECRET` is set and you are on `https://`, not `http://`.
- **Empty data after every deploy:** Live SQLite and Normal Backend users now live in a folder outside the deploy tree (`~/.harbor-commerce`). Created ops users stay until you delete them. If an old deploy still resets, Redeploy **`main`** then Restart.
- **npm audit / “7 vulnerabilities” after a green Next.js build:** Hostinger is blocking install on `next@16.3.1` and nested Prisma/js-yaml/sharp advisories. Latest **`main`** uses Next.js **16.3.5** and `package.json` overrides. Deploy **`main` again** (do not “Fix and redeploy” the old failed snapshot). Then **Restart**. Do not upgrade Prisma to 7 on Hostinger; SQLite `db push` stays on Prisma 6.

### 9. Later, when you buy a domain

In the site dashboard → **Domains** → **Add domain** → set it as primary. The free `hostingersite.com` URL can stay as a secondary address.

---

## Hostinger says “This repository is missing a package.json file”

Hostinger scans the **default branch** (`main`) at the **repo root**. This project’s `package.json` is on `main` next to `README.md`, `next.config.js`, and `app/`.

If you still see that message:

1. In hPanel, pick branch **`main`**, not an old/empty copy of the repo.
2. Root directory must be empty or `.` — not a subfolder.
3. Do not choose **Continue as a static website**.
4. If 