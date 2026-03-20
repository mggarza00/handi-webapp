export type ActiveViewRole = "client" | "pro";

export type ResolveActiveViewInput = {
  activeRoleCookie?: string | null;
  profileRole?: string | null;
  isClientPro?: boolean | null;
  professionalIsActive: boolean;
};

export function hasProCapability(input: {
  profileRole?: string | null;
  isClientPro?: boolean | null;
}): boolean {
  const profileRole = (input.profileRole || "").toString().trim().toLowerCase();
  return profileRole === "pro" || input.isClientPro === true;
}

export function resolveActiveView(
  input: ResolveActiveViewInput,
): ActiveViewRole {
  const cookieRole = (input.activeRoleCookie || "")
    .toString()
    .trim()
    .toLowerCase();
  const hasActiveProfessional = input.professionalIsActive === true;
  const proCapability = hasProCapability(input);

  if (cookieRole === "pro" && hasActiveProfessional && proCapability)
    return "pro";
  if (cookieRole === "client") return "client";

  // Fallback when cookie is missing/desynced: default to pro only when
  // user can operate as pro and has an active professional profile.
  if (hasActiveProfessional && proCapability) return "pro";

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
