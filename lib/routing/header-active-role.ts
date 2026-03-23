import { resolveActiveView } from "@/lib/routing/active-view";

export type HeaderRole = "client" | "pro" | "admin" | null;

type ResolveHeaderRoleInput = {
  isAuth: boolean;
  isAdmin: boolean;
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
  if (input.isAdmin || normalizedProfileRole === "admin") return "admin";
  return resolveActiveView({
    activeRoleCookie: input.activeRoleCookie,
    profileRole: normalizedProfileRole || null,
    isClientPro: input.isClientPro ?? false,
    professionalIsActive: input.professionalIsActive,
  });
}
