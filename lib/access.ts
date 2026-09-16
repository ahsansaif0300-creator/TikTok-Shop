import type { Role } from "@prisma/client";

export const LOGIN = {
  admin: "/login/admin",
  ops: "/login/ops",
  store: "/login/store",
  support: "/login/support",
} as const;

export function isPublicPath(pathname: string) {
  if (pathname === "/welcome" || pathname === "/signup") return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname.startsWith("/s/")) return true;
  if (pathname.startsWith("/product-art/")) return true;
  return false;
}

export function loginPathForRequest(pathname: string) {
  if (isSupportDeskPath(pathname)) return LOGIN.support;
  if (isSuperAdminPath(pathname)) return LOGIN.admin;
  if (isStaffPath(pathname)) return LOGIN.ops;
  if (isMerchantOnlyPath(pathname)) return LOGIN.store;
  if (pathname === "/") return "/welcome";
  return LOGIN.store;
}

export function isSupportDeskPath(pathname: string) {
  return pathname === "/support-desk" || pathname.startsWith("/support-desk/");
}

export function isSuperAdminPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/users" ||
    pathname.startsWith("/users/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  );
}

export function isStaffPath(pathname: string) {
  return (
    pathname === "/merchants" ||
    pathname.startsWith("/merchants/") ||
    pathname === "/categories" ||
    pathname.startsWith("/categories/") ||
    pathname === "/customers" ||
    pathname.startsWith("/customers/")
  );
}

export function isMerchantOnlyPath(pathname: string) {
  return (
    pathname === "/distribution" ||
    pathname.startsWith("/distribution/") ||
    pathname === "/withdraw" ||
    pathname.startsWith("/withdraw/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/recharge" ||
    pathname.startsWith("/recharge/")
  );
}

export function canAccessPath(role: Role, pathname: string) {
  if (isSupportDeskPath(pathname)) return role === "SUPER_ADMIN" || role === "OPS";
  if (isSuperAdminPath(pathname)) return role === "SUPER_ADMIN";
  if (isStaffPath(pathname)) return role === "SUPER_ADMIN" || role === "OPS";
  if (isMerchantOnlyPath(pathname)) return role === "MERCHANT";
  return true;
}

export function loginPathForRole(role: Role) {
  if (role === "SUPER_ADMIN") return LOGIN.admin;
  if (role === "OPS") return LOGIN.ops;
  return LOGIN.store;
}
