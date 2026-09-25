import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { persistentDataDirs, repoRoot } from "../scripts/copy-demo-db.mjs";

export const REMOTE_OPS_PATH = "persist/backend-users.json";
export const REMOTE_STORES_PATH = "persist/shops.json";

export function persistRepo() {
  return (
    process.env.HARBOR_PERSIST_REPO?.trim() ||
    process.env.RENDER_GIT_REPO?.trim() ||
    "ahsansaif0300-creator/TikTok-Shop"
  );
}

export function persistBranch() {
  return process.env.HARBOR_PERSIST_BRANCH?.trim() || "harbor-persist";
}

function persistToken() {
  return (
    process.env.HARBOR_PERSIST_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    ""
  );
}

export function persistRawUrl(relPath: string) {
  return `https://raw.githubusercontent.com/${persistRepo()}/${persistBranch()}/${relPath}`;
}

async function pullText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json,text/plain;q=0.9,*/*;q=0.8" },
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text.trim() ? text : null;
  } catch (error) {
    console.warn("[harbor] remote persist fetch skipped", url, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function pullRemoteText(relPath: string) {
  return (
    (await pullText(persistRawUrl(relPath))) ||
    (await pullText(`https://raw.githubusercontent.com/${persistRepo()}/main/${relPath}`))
  );
}

function cacheDirs(fileName: string) {
  return persistentDataDirs(repoRoot()).map((dir) => path.join(dir, fileName));
}

function writeCaches(fileName: string, body: string) {
  for (const file of cacheDirs(fileName)) {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, body.endsWith("\n") ? body : `${body}\n`);
    } catch (error) {
      console.warn("[harbor] remote persist cache write skipped", file, error);
    }
  }
}

export async function pullRemotePersist() {
  const pulled: string[] = [];
  const ops = await pullRemoteText(REMOTE_OPS_PATH);
  if (ops) {
    writeCaches("ops-users.json", ops);
    pulled.push("ops");
  }
  const stores = await pullRemoteText(REMOTE_STORES_PATH);
  if (stores) {
    writeCaches("store-records.json", stores);
    pulled.push("stores");
  }
  if (pulled.length) {
    console.log(`[harbor] Pulled remote persist (${pulled.join(", ")}) from ${persistRepo()}@${persistBranch()}`);
  }
  return pulled.length;
}

export async function pushRemoteText(relPath: string, body: string) {
  const token = persistToken();
  if (!token) return false;
  const repo = persistRepo();
  const branch = persistBranch();
  const api = `https://api.github.com/repos/${repo}/contents/${relPath}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tikitok-shop-persist",
  };
  let sha: string | undefined;
  try {
    const existing = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers, cache: "no-store" });
    if (existing.ok) {
      const json = (await existing.json()) as { sha?: string };
      sha = json.sha;
    }
  } catch (error) {
    console.warn("[harbor] remote persist sha lookup skipped", error);
  }
  try {
    const response = await fetch(api, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Persist ${relPath}`,
        content: Buffer.from(body.endsWith("\n") ? body : `${body}\n`).toString("base64"),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.warn("[harbor] remote persist push failed", response.status, detail.slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[harbor] remote persist push skipped", error);
    return false;
  }
}

export function queueRemotePush(relPath: string, body: string) {
  void pushRemoteText(relPath, body);
}
