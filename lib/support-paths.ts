export function supportInboxPath(role: string) {
  return role === "MERCHANT" ? "/service" : "/support-desk";
}

export function supportThreadPath(role: string, merchantId: string) {
  if (role === "MERCHANT") return "/service";
  return `/support-desk/${merchantId}`;
}
