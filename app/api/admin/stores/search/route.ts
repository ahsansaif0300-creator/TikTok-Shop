import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchOrderSenderStores } from "@/lib/order-sender";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "auth" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") ?? "");
  const stores = await searchOrderSenderStores(q);
  return NextResponse.json({ ok: true, stores });
}
