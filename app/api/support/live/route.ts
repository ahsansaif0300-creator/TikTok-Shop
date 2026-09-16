import { NextResponse } from "next/server";
import { getSession, isStaff } from "@/lib/auth";
import { deliverSupportMessage } from "@/lib/support-deliver";
import { loadLiveInbox, loadLiveThread } from "@/lib/support-live";
import { setSupportTyping } from "@/lib/support-typing";

export const dynamic = "force-dynamic";

function merchantIdFor(session: { role: string; merchantId: string | null }, requested: string) {
  if (session.role === "MERCHANT") return session.merchantId || "";
  return requested;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });

  const url = new URL(request.url);
  const wantInbox = url.searchParams.get("inbox") === "1";
  const requested = String(url.searchParams.get("merchantId") ?? "");
  const merchantId = merchantIdFor(session, requested);

  if (wantInbox && !isStaff(session.role)) {
    return NextResponse.json({ error: "auth" }, { status: 403 });
  }

  const inbox = wantInbox && isStaff(session.role) ? await loadLiveInbox() : null;
  const thread = merchantId ? await loadLiveThread(merchantId) : null;
  if (session.role === "MERCHANT" && !merchantId) {
    return NextResponse.json({ error: "store" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    inbox,
    thread,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = (await request.json().catch(() => null)) as { merchantId?: string; typing?: boolean } | null;
    const merchantId = merchantIdFor(session, String(payload?.merchantId ?? ""));
    if (!merchantId) return NextResponse.json({ error: "store" }, { status: 400 });
    if (session.role === "MERCHANT" && session.merchantId !== merchantId) {
      return NextResponse.json({ error: "store" }, { status: 403 });
    }
    setSupportTyping(merchantId, isStaff(session.role) ? "AGENT" : "STORE", session.name);
    return NextResponse.json({ ok: true, typing: true });
  }

  const form = await request.formData();
  const merchantId = merchantIdFor(session, String(form.get("merchantId") ?? ""));
  const file = form.get("media");
  const result = await deliverSupportMessage({
    session,
    merchantId,
    body: String(form.get("body") ?? ""),
    file: file instanceof File ? file : null,
  });
  if (!result.ok) {
    const status = result.error === "expired" ? 409 : result.error === "store" ? 400 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, message: result.message });
}
