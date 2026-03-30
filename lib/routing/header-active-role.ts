import { resolveActiveView } from "@/lib/routing/active-view";

export type HeaderRole = "client" | "pro" | null;

export type ResolveHeaderRoleInput = {
  isAuth: boolean;
  activeRoleCookie?: string | null;
  profileRole?: string | null;
  isClientPro?: boolean | null;
  professionalIsActive: boolean;
};

export type ResolveClientNavigationInput = ResolveHeaderRoleInput & {
  proApply?: boolean | null;
};

export function resolveHeaderRole(input: ResolveHeaderRoleInput): HeaderRole {
  if (!input.isAuth) return null;
  const normalizedProfileRole = (input.profileRole || "")
    .toString()
    .trim()
    .toLowerCase();
  return resolveActiveView({
    activeRoleCookie: input.activeRoleCookie,
    profileRole: normalizedProfileRole || null,
    isClientPro: input.isClientPro ?? false,
    professionalIsActive: input.professionalIsActive,
  });
}

export function shouldHideClientNavigationForProApply(
  input: ResolveClientNavigationInput,
): boolean {
  if (input.proApply !== true) return false;

  // Legacy pro-apply cookies can linger after approval. Once the user has
  // dual-role capability or an active professional profile, client nav should
  // follow the effective active_role instead of the stale cookie.
  if (input.isClientPro === true || input.professionalIsActive === true) {
    return false;
  }

  return true;
}

export function shouldShowClientNavigation(
  input: ResolveClientNavigationInput,
): boolean {
  if (!input.isAuth || shouldHideClientNavigationForProApply(input)) {
    return false;
  }

  return resolveHeaderRole(input) === "client";
}
