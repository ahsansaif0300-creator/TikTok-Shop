import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listLiveOrders } from "@/lib/orders-query";

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

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return noStore({ error: "auth" }, 401);

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") ?? "");
  const q = String(url.searchParams.get("q") ?? "");
  const orders = await listLiveOrders(session, { status, q });

  return noStore({
    ok: true,
    orders,
    generatedAt: new Date().toISOString(),
  });
}
