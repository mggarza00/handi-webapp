export type ActiveViewRole = "client" | "pro";

export type ResolveActiveViewInput = {
  activeRoleCookie?: string | null;
  profileRole?: string | null;
  isClientPro?: boolean | null;
  professionalIsActive: boolean;
};

export function resolveActiveView(
  input: ResolveActiveViewInput,
): ActiveViewRole {
  const cookieRole = (input.activeRoleCookie || "")
    .toString()
    .trim()
    .toLowerCase();
  const profileRole = (input.profileRole || "").toString().trim().toLowerCase();
  const hasActiveProfessional = input.professionalIsActive === true;

  if (cookieRole === "pro" && hasActiveProfessional) return "pro";
  if (cookieRole === "client") return "client";

  // Fallback when cookie is missing/desynced: prefer DB role only if pro is truly active.
  if (profileRole === "pro" && hasActiveProfessional) return "pro";

  // client/admin/unknown always collapse to client-facing home.
  return "client";
}

export function getDefaultHomeForActiveRole(
  role: ActiveViewRole,
): "/" | "/pro" {
  return role === "pro" ? "/pro" : "/";
}

export function canAccessProHome(input: ResolveActiveViewInput): boolean {
  return (
    resolveActiveView(input) === "pro" && input.professionalIsActive === true
  );
}
