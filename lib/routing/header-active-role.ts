import { resolveActiveView } from "@/lib/routing/active-view";

export type HeaderRole = "client" | "pro" | null;

type ResolveHeaderRoleInput = {
  isAuth: boolean;
  activeRoleCookie?: string | null;
  profileRole?: string | null;
  isClientPro?: boolean | null;
  professionalIsActive: boolean;
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
