import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import RoleOnboarding from "./role-onboarding.client";
import HideHeaderRequestsLink from "./HideHeaderRequestsLink.client";

import { ApiError, getAuthContext } from "@/lib/_supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONBOARDING_PATH = "/onboarding/elige-rol";

type SearchParams = {
  next?: string | string[];
  toast?: string | string[];
};

function safeNextParam(next: string | string[] | undefined): string | null {
  const value = Array.isArray(next) ? next[0] : next;
  if (typeof value !== "string") return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith(ONBOARDING_PATH)) return null;
  return value;
}

export default async function ChooseRolePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const safeNext = safeNextParam(searchParams?.next);
  const returnTo = safeNext || "/";
  const toastKey =
    typeof searchParams?.toast === "string" ? searchParams.toast : undefined;
  const onboardingReturn = safeNext
    ? `${ONBOARDING_PATH}?next=${encodeURIComponent(safeNext)}`
    : ONBOARDING_PATH;

  let authContext: Awaited<ReturnType<typeof getAuthContext>>;
  try {
    authContext = await getAuthContext();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const signInUrl = `/auth/sign-in?next=${encodeURIComponent(onboardingReturn)}`;
      redirect(signInUrl);
    }
    throw e;
  }

  const { supabase, user } = authContext;
  if (!user) {
    const signInUrl = `/auth/sign-in?next=${encodeURIComponent(onboardingReturn)}`;
    redirect(signInUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const role =
    (profile as { role?: string | null } | null)?.role?.toLowerCase() ?? null;

  if (role) {
    redirect(returnTo);
  }

  const cookieRole = cookies().get("handi_pre_role")?.value || "";
  const preselectedRole =
    cookieRole === "pro"
      ? "profesional"
      : cookieRole === "client"
        ? "cliente"
        : null;

  const preferredName =
    (profile as { full_name?: string | null } | null)?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    "Handi";

  return (
    <>
      <HideHeaderRequestsLink />
      <RoleOnboarding
        name={preferredName}
        email={user.email ?? null}
        next={returnTo}
        preselectedRole={preselectedRole}
        toastKey={toastKey}
      />
    </>
  );
}
