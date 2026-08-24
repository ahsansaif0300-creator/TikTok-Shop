import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromToken } from "@/lib/auth";
import { shopSlugFromHost } from "@/lib/shop-host";

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname === "/signup" || pathname.startsWith("/s/");
}

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
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/login" || pathname === "/signup")) {
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
