#!/usr/bin/env node
/**
 * Pull live persist snapshots and write data/ops-users.json plus data/store-records.json.
 * Used by .github/workflows/harbor-persist.yml
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.HARBOR_PERSIST_LIVE_URL || "https://tikitok-shop.onrender.com").replace(/\/$/, "");
const EMAIL = process.env.HARBOR_PERSIST_ADMIN_EMAIL || "oscar.d@example.net";
const PASSWORD = process.env.HARBOR_PERSIST_ADMIN_PASSWORD || "HarborAdmin!2026";
const SECRET = process.env.HARBOR_PERSIST_SECRET || "";
const OUT = process.env.HARBOR_PERSIST_OUT || process.cwd();

async function readActionId(html, needle) {
  const re = /name="(\$ACTION_ID_[^"]+)"/g;
  let match;
  while ((match = re.exec(html))) {
    const window = html.slice(Math.max(0, match.index - 800), match.index + 800);
    if (window.includes(needle)) return match[1];
  }
  const first = html.match(/name="(\$ACTION_ID_[^"]+)"/);
  return first?.[1] || "";
}

async function main() {
  const cookieJar = [];
  function cookieHeader() {
    return cookieJar.map((item) => item.split(";")[0]).join("; ");
  }
  function takeCookies(response) {
    const raw = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    for (const item of raw) {
      const key = item.split("=")[0];
      const rest = cookieJar.filter((row) => !row.startsWith(`${key}=`));
      cookieJar.length = 0;
      cookieJar.push(...rest, item);
    }
  }

  if (SECRET) {
    const direct = await fetch(`${BASE}/api/harbor/persist`, {
      headers: { "x-harbor-persist": SECRET, Accept: "application/json" },
      cache: "no-store",
    });
    if (direct.ok) {
      await writePayload(await direct.json());
      if (process.argv.includes("--heal")) {
        const healed = await fetch(`${BASE}/api/harbor/persist`, {
          method: "POST",
          headers: { "x-harbor-persist": SECRET, Accept: "application/json" },
        });
        console.log("heal", healed.status);
      }
      return;
    }
  }

  const loginPage = await fetch(`${BASE}/login/admin`, { cache: "no-store" });
  takeCookies(loginPage);
  const loginHtml = await loginPage.text();
  const action = await readActionId(loginHtml, "password");
  if (!action) throw new Error("admin login ACTION_ID missing");
  const form = new FormData();
  form.set(action, "");
  form.set("email", EMAIL);
  form.set("password", PASSWORD);
  const posted = await fetch(`${BASE}/login/admin`, {
    method: "POST",
    body: form,
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  takeCookies(posted);
  const persist = await fetch(`${BASE}/api/harbor/persist`, {
    headers: { cookie: cookieHeader(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!persist.ok) {
    throw new Error(`persist export failed ${persist.status}`);
  }
  await writePayload(await persist.json());
  if (process.argv.includes("--heal")) {
    const healed = await fetch(`${BASE}/api/harbor/persist`, {
      method: "POST",
      headers: { cookie: cookieHeader(), Accept: "application/json" },
    });
    console.log("heal", healed.status);
  }
}

function readJson(file) {
  try {
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function mergeOps(existing, incoming) {
  const users = new Map();
  const deleted = new Set();
  for (const part of [existing, incoming]) {
    for (const email of part?.deletedEmails ?? []) deleted.add(String(email).trim().toLowerCase());
    for (const user of part?.users ?? []) {
      const email = String(user?.email || "").trim().toLowerCase();
      if (email) users.set(email, { ...user, email });
    }
  }
  for (const email of deleted) users.delete(email);
  return {
    updatedAt: new Date().toISOString(),
    users: [...users.values()],
    deletedEmails: [...deleted],
  };
}

function mergeStores(existing, incoming) {
  const stores = new Map();
  const deleted = new Set();
  const orphans = new Map();
  for (const part of [existing, incoming]) {
    for (const slug of part?.deletedSlugs ?? []) deleted.add(String(slug).trim());
    for (const store of part?.stores ?? []) {
      if (store?.slug) stores.set(store.slug, store);
    }
    for (const application of part?.orphanApplications ?? []) {
      const key = `${application?.email || ""}::${application?.businessName || ""}`;
      if (key !== "::") orphans.set(key, application);
    }
  }
  for (const slug of deleted) stores.delete(slug);
  return {
    updatedAt: new Date().toISOString(),
    stores: [...stores.values()],
    deletedSlugs: [...deleted],
    orphanApplications: [...orphans.values()],
  };
}

async function writePayload(payload) {
  if (!payload?.ok || !payload.ops) throw new Error("persist payload missing ops");
  mkdirSync(path.join(OUT, "persist"), { recursive: true });
  const opsFile = path.join(OUT, "persist", "backend-users.json");
  const shopsFile = path.join(OUT, "persist", "shops.json");
  const packedShops = path.join(OUT, "prisma", "recovered-stores.json");
  const ops = mergeOps(readJson(opsFile), payload.ops);
  writeFileSync(opsFile, `${JSON.stringify(ops, null, 2)}\n`);
  if (payload.stores) {
    const shops = mergeStores(readJson(shopsFile) || readJson(packedShops), payload.stores);
    if ((readJson(shopsFile)?.stores?.length || 0) > shops.stores.length) {
      console.log("skip shrinking shops.json", readJson(shopsFile).stores.length, "->", shops.stores.length);
    } else {
      writeFileSync(shopsFile, `${JSON.stringify(shops)}\n`);
    }
  }
  console.log(
    JSON.stringify({
      ok: true,
      users: ops.users?.length ?? 0,
      stores: payload.stores?.stores?.length ?? 0,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
