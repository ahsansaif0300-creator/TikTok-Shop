# Go live on Hostinger with a temporary domain

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
5. Hostinger generates an address such as `yourname.hostingersite.com`. Copy it. You will open `https://THAT-ADDRESS/login` when deploy finishes.

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

Set `APP_BASE_URL` to the same URL people type in the browser (no trailing slash). Harbor uses it when it prints a shop link such as `https://YOUR-TEMP-DOMAIN.hostingersite.com/s/northline-outfitters`.

After you attach a **custom domain**, change `APP_BASE_URL` to `https://yourdomain.com`. If you also add a wildcard DNS record (`*.yourdomain.com`) pointing at the same app, set `SHOP_BASE_DOMAIN=yourdomain.com` so each shop can be opened as `https://shop-slug.yourdomain.com`. Without wildcard DNS, keep using `/s/shop-slug` on the main domain.

### 6. Deploy

Click **Deploy**. Wait until the build is green and the process badge is **Running**.

First start creates SQLite and the demo accounts if `prisma/dev.db` is missing.

### 7. Open it

1. In the website dashboard, open the **temporary domain**.
2. Turn on **SSL** if the padlock is missing (**Security → SSL**).
3. Visit:

   `https://YOUR-TEMP-DOMAIN.hostingersite.com/login`

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
- **Site not reachable / 403:** do not edit `public_html/.htaccess`. Redeploy so Hostinger regenerates it.
- **“Harbor could not open the workspace database” / “packed demo database”:** Redeploy the latest **`main`** branch (it includes `prisma/demo.sqlite`). Then **Restart**. `DATABASE_URL` can stay `file:./dev.db`; the app copies the packed demo DB into a writable folder automatically.
- **App built but login loop:** confirm `AUTH_SECRET` is set and you are on `https://`, not `http://`.
- **Empty data after every deploy:** SQLite lives in the app folder and can reset on redeploy. Fine for a demo. For real orders, move to a VPS disk or hosted Postgres later.

### 9. Later, when you buy a domain

In the site dashboard → **Domains** → **Add domain** → set it as primary. The free `hostingersite.com` URL can stay as a secondary address.

---

## Hostinger says “This repository is missing a package.json file”

Hostinger scans the **default branch** (`main`) at the **repo root**. This project’s `package.json` is on `main` next to `README.md`, `next.config.ts`, and `app/`.

If you still see that message:

1. In hPanel, pick branch **`main`**, not an old/empty copy of the repo.
2. Root directory must be empty or `.` — not a subfolder.
3. Do not choose **Continue as a static website**.
4. If GitHub still shows only a README on `main`, refresh repositories in hPanel after this merge has been pushed.
