import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromToken } from "@/lib/auth";
import { shopSlugFromHost } from "@/lib/shop-host";
import { canAccessPath, isPublicPath, loginPathForRequest } from "@/lib/access";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const shopSlug = shopSlugFromHost(host);

  if (shopSlug && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/s/${shopSlug}`;
    return NextResponse.rewrite(url);
  }

  const session = await readSessionFromToken(request.cookies.get("harbor_session")?.value);
  const publicPath = isPublicPath(pathname);

  if (!session && !publicPath) {
    const url = request.nextUrl.clone();
    url.pathname = loginPathForRequest(pathname);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/welcome" || pathname === "/signup" || pathname === "/login" || pathname.startsWith("/login/"))) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/login/support" && session.role !== "MERCHANT" ? "/support-desk" : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session && !publicPath && !canAccessPath(session.role, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
