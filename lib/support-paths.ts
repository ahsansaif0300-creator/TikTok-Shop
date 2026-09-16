export function supportInboxPath(role: string) {
  return role === "SUPER_ADMIN" ? "/admin/support" : "/service";
}

export function supportThreadPath(role: string, merchantId: string) {
  if (role === "SUPER_ADMIN") return `/admin/support/${merchantId}`;
  if (role === "MERCHANT") return "/service";
  return `/service/${merchantId}`;
}
