export const ADMIN_ROLES = new Set(["owner", "admin", "ops", "finance", "support", "reviewer"]);
export function canAccessAdmin(role?: string | null, is_admin?: boolean | null) {
  if (is_admin) return true;
  return role ? ADMIN_ROLES.has(role.toLowerCase()) : false;
}

