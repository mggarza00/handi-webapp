import type { HeaderRole } from "@/lib/routing/header-active-role";

type ClientTabbarVisibilityInput = {
  isAuth: boolean;
  effectiveRole: HeaderRole;
  isClientPro: boolean;
  proApply: boolean;
  pathname: string | null | undefined;
};

type ProTabbarVisibilityInput = {
  effectiveRole: HeaderRole;
  isClientPro: boolean;
  pathname: string | null | undefined;
};

export function isProWorkspacePath(
  pathname: string | null | undefined,
): boolean {
  const normalizedPath = (pathname ?? "").trim().toLowerCase();
  if (!normalizedPath) return false;
  return (
    normalizedPath.startsWith("/pro") ||
    normalizedPath.startsWith("/applied") ||
    normalizedPath.startsWith("/requests/explore")
  );
}

export function shouldShowMobileClientTabbar(
  input: ClientTabbarVisibilityInput,
): boolean {
  if (!input.isAuth || input.proApply) return false;
  if (input.effectiveRole === "client") return true;
  return input.isClientPro && !isProWorkspacePath(input.pathname);
}

export function shouldShowProMobileTabbar(
  input: ProTabbarVisibilityInput,
): boolean {
  if (input.effectiveRole !== "pro") return false;
  if (!input.isClientPro) return true;
  return isProWorkspacePath(input.pathname);
}
