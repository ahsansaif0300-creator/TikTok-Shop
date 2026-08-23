<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Harbor Commerce OS is a single Next.js 16 (App Router) + Prisma app backed by a local **SQLite** file — there is no external database, so nothing extra needs to start. Standard commands live in `README.md` and `package.json`; the notes below are only the non-obvious caveats.

- **Package manager is npm** (`package-lock.json`). `postinstall` runs `prisma generate` automatically, so the Prisma client is ready after `npm install`.
- **You must create the database before running the app.** `prisma/dev.db` is gitignored and is NOT created by `npm run dev`. Run `npm run setup` once first (it does `prisma generate` + `prisma db push` + seed). Without it, `npm run dev` starts but every page throws "no such table". The update script intentionally does not seed, because the seed (`prisma/seed.ts`) wipes and recreates all data on each run.
- `.env` is gitignored; the update script copies `.env.example` → `.env` if missing. It only needs `DATABASE_URL`, `AUTH_SECRET`, and `PORT`; the placeholder `AUTH_SECRET` works for local dev (sessions use `jose`).
- **Dev server:** `npm run dev` binds `0.0.0.0:3000`. `next.config.ts` lists specific `allowedDevOrigins` / Server Action origins for Cursor preview hosts; if a new pod's preview hostname is rejected for logins/Server Actions, add it there.
- **Demo login accounts** (from the seed) are listed in `README.md`; e.g. super admin `oscar.d@example.net` / `HarborAdmin!2026`.
- **Checks:** `npm run lint`, `npm run verify` (files + seeded-data lifecycle), and `npm run verify:http` (run while the dev server is listening — validates the login wall and role/merchant scoping). `npm run build` is the production build; use `npm run dev` for development.
- To reset demo data to a clean state, run `npm run db:reset` (force-resets the schema and re-seeds).
