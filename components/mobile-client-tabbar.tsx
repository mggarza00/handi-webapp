import { cookies } from "next/headers";

import MobileClientTabbarButtons from "@/components/mobile-client-tabbar.client";
import { shouldShowClientNavigation } from "@/lib/routing/header-active-role";
import createClient from "@/utils/supabase/server";

// Reemplazamos iconos lucide por imágenes GIF de marca

type Role = "client" | "pro" | "admin";
type ProfileRow = { role: Role | null; is_client_pro: boolean | null };
type ProfessionalRow = { active: boolean | null };

async function getSessionInfoSafe() {
  try {
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return {
        isAuth: false as const,
        profileRole: null as null,
        isClientPro: false as const,
        professionalIsActive: false as const,
      };
    }
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      return {
        isAuth: false as const,
        profileRole: null as null,
        isClientPro: false as const,
        professionalIsActive: false as const,
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
      .maybeSingle<ProfessionalRow>();

    return {
      isAuth: true as const,
      profileRole: profileRaw?.role ?? null,
      isClientPro: profileRaw?.is_client_pro === true,
      professionalIsActive: professionalRaw?.active === true,
    };
  } catch {
    return {
      isAuth: false as const,
      profileRole: null as null,
      isClientPro: false as const,
      professionalIsActive: false as const,
    };
  }
}

export default async function MobileClientTabBar() {
  const { isAuth, profileRole, isClientPro, professionalIsActive } =
    await getSessionInfoSafe();
  const cookieStore = cookies();
  const activeRoleCookie = cookieStore.get("active_role")?.value ?? null;
  const proApply =
    cookieStore.get("handi_pro_apply")?.value === "1" ||
    cookieStore.get("handee_pro_apply")?.value === "1";

  if (
    !shouldShowClientNavigation({
      isAuth,
      activeRoleCookie,
      profileRole,
      isClientPro,
      professionalIsActive,
      proApply,
    })
  ) {
    return null;
  }

  return (
    <div
      id="mobile-client-tabbar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-neutral-50/80 dark:bg-neutral-900/40 backdrop-blur-md"
    >
      <div className="mx-auto max-w-5xl px-4">
        <MobileClientTabbarButtons />
      </div>
    </div>
  );
}
