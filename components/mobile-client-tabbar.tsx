import { cookies } from "next/headers";

import MobileClientTabbarButtons from "@/components/mobile-client-tabbar.client";
import createClient from "@/utils/supabase/server";

// Reemplazamos iconos lucide por imágenes GIF de marca

type Role = "client" | "pro" | "admin";
type ProfileRow = { role: Role | null };

async function getSessionInfoSafe() {
  try {
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return { isAuth: false as const, role: null as null };
    }
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return { isAuth: false as const, role: null as null };
    const { data: profileRaw } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();
    const role = profileRaw?.role ?? null;
    return { isAuth: true as const, role };
  } catch {
    return { isAuth: false as const, role: null as null };
  }
}

export default async function MobileClientTabBar() {
  const { isAuth, role } = await getSessionInfoSafe();
  const cookieStore = cookies();
  const proApply =
    cookieStore.get("handi_pro_apply")?.value === "1" ||
    cookieStore.get("handee_pro_apply")?.value === "1";

  if (!isAuth || role !== "client" || proApply) return null;

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
