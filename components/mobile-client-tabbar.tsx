import { cookies } from "next/headers";

import MobileClientTabBarShell from "@/components/mobile-client-tabbar-shell.client";
import { resolveHeaderRole } from "@/lib/routing/header-active-role";
import createClient from "@/utils/supabase/server";

type Role = "client" | "pro" | "admin";
type ProfileRow = {
  role: Role | null;
  is_client_pro?: boolean | null;
};

async function getSessionInfoSafe() {
  try {
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return {
        isAuth: false as const,
        role: null as null,
        is_client_pro: false as const,
        professional_is_active: false as const,
      };
    }
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      return {
        isAuth: false as const,
        role: null as null,
        is_client_pro: false as const,
        professional_is_active: false as const,
      };
    }
    const { data: profileRaw } = await supabase
      .from("profiles")
      .select("role, is_client_pro")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();
    const { data: professionalRaw } = await supabase
      .from("professionals")
      .select("active")
      .eq("id", user.id)
      .maybeSingle<{ active: boolean | null }>();
    return {
      isAuth: true as const,
      role: profileRaw?.role ?? null,
      is_client_pro: profileRaw?.is_client_pro === true,
      professional_is_active: professionalRaw?.active === true,
    };
  } catch {
    return {
      isAuth: false as const,
      role: null as null,
      is_client_pro: false as const,
      professional_is_active: false as const,
    };
  }
}

export default async function MobileClientTabBar() {
  const { isAuth, role, is_client_pro, professional_is_active } =
    await getSessionInfoSafe();
  const cookieStore = cookies();
  const activeRoleCookie = cookieStore.get("active_role")?.value ?? null;
  const proApply =
    cookieStore.get("handi_pro_apply")?.value === "1" ||
    cookieStore.get("handee_pro_apply")?.value === "1";
  const effectiveRole = resolveHeaderRole({
    isAuth,
    activeRoleCookie,
    profileRole: role,
    isClientPro: is_client_pro,
    professionalIsActive: professional_is_active,
  });

  return (
    <MobileClientTabBarShell
      isAuth={isAuth}
      effectiveRole={effectiveRole}
      isClientPro={is_client_pro}
      proApply={proApply}
    />
  );
}
