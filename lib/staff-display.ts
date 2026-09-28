export const SUPER_ADMIN_PUBLIC_NAME = "ID No 004";

export function displayStaffName(user: { name: string; role: string }) {
  if (user.role === "SUPER_ADMIN") return SUPER_ADMIN_PUBLIC_NAME;
  return user.name;
}
