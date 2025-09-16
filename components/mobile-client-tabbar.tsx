import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
// Reemplazamos iconos lucide por imágenes GIF de marca

import { Button } from "@/components/ui/button";
import type { Database } from "@/types/supabase";

type Role = "client" | "pro" | "admin";

async function getSessionInfoSafe() {
  try {
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return { isAuth: false as const, role: null as null };
    }
    const supabase = createServerComponentClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return { isAuth: false as const, role: null as null };
    const { data: profileRaw } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profileRaw?.role ?? null) as Role | null;
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/90 dark:bg-neutral-900/70 backdrop-blur"
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-stretch gap-2 h-14">
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="flex-1 h-full justify-center gap-2 hover:bg-[#E6F4FF] hover:text-[#11314B]"
          >
            <Link href="/requests?mine=1" aria-label="Mis solicitudes">
              <Image
                src="/images/icono-mis-solicitudes.gif"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span>Mis solicitudes</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="flex-1 h-full justify-center gap-2 hover:bg-[#E6F4FF] hover:text-[#11314B]"
          >
            <Link href="/requests/new" aria-label="Nueva solicitud">
              <Image
                src="/images/icono-nueva-solicitud.gif"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span>Nueva solicitud</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
