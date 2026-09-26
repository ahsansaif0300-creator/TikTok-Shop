import { NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { ensureDatabase } from "@/lib/ensure-db";
import { prisma } from "@/lib/db";
import { readOpsSnapshots, restoreOpsUsers, snapshotOpsUsers } from "@/lib/ops-users-store";
import { readStoreSnapshots, restoreStores, snapshotStores } from "@/lib/stores-persist";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

async function allowExport(request: Request) {
  const session = await getSession();
  if (session && isStaff(session.role)) return true;
  const secret = process.env.HARBOR_PERSIST_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("x-harbor-persist") || request.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!(await allowExport(request))) return noStore({ error: "auth" }, 401);
  try {
    await ensureDatabase();
  } catch (error) {
    console.warn("[harbor] persist export database skipped", error);
  }
  await snapshotOpsUsers(prisma);
  await snapshotStores(prisma);
  const ops = readOpsSnapshots();
  const stores = readStoreSnapshots();
  return noStore({
    ok: true,
    updatedAt: new Date().toISOString(),
    ops,
    stores: { updatedAt: new Date().toISOString(), stores },
  });
}

export async function POST(request: Request) {
  if (!(await allowExport(request))) return noStore({ error: "auth" }, 401);
  try {
    await ensureDatabase();
    const restoredUsers = await restoreOpsUsers(prisma);
    const restoredStores = await restoreStores(prisma);
    return noStore({ ok: true, restoredUsers, restoredStores });
  } catch (error) {
    console.warn("[harbor] persist restore endpoint skipped", error);
    return noStore({ error: "restore" }, 500);
  }
}
