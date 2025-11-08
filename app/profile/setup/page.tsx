import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import createClient from "@/utils/supabase/server";

import SetupForm from "./setup.client";
import { createChangeRequest } from "./actions";

import Breadcrumbs from "@/components/breadcrumbs";
import PageContainer from "@/components/page-container";
import { Card } from "@/components/ui/card";
import SetupHeader from "@/components/profile/SetupHeader";
import PendingAlert from "@/components/profile/PendingAlert";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function ProfileSetupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, headline, bio, years_experience, city, categories, subcategories, role, is_client_pro",
    )
    .eq("id", user.id)
    .maybeSingle<any>();

  // Load professional extra fields (cities) if present
  const { data: pro } = await supabase
    .from("professionals")
    .select("full_name, cities, city, headline, years_experience, bio, avatar_url, categories, subcategories")
    .eq("id", user.id)
    .maybeSingle<any>();

  const isPro = (profile?.role === "pro") || (profile as any)?.is_client_pro === true;

  // Solicitudes pendientes (si existe la tabla)
  let pendingAt: string | null = null;
  try {
    const { data: req } = await supabase
      .from("profile_change_requests")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<any>();
    pendingAt = (req?.created_at as string | null) ?? null;
  } catch {
    pendingAt = null;
  }

  // Compute robust fallbacks for name and avatar (from professionals or auth metadata)
  const fullNameFallback =
    (profile as any)?.full_name ??
    (pro as any)?.full_name ??
    (user?.user_metadata as any)?.full_name ??
    (user?.user_metadata as any)?.name ??
    (user?.user_metadata as any)?.user_name ??
    (user?.user_metadata as any)?.preferred_username ??
    user?.email ??
    null;

  const avatarUrlFallback =
    (pro as any)?.avatar_url ??
    (profile as any)?.avatar_url ??
    (user?.user_metadata as any)?.avatar_url ??
    (user?.user_metadata as any)?.picture ??
    null;

  const normalizeNamed = (raw: unknown): any => {
    if (Array.isArray(raw)) {
      return raw.map((x: any) => (typeof x === "string" ? { name: x } : x));
    }
    if (typeof raw === "string") return raw; // CSV supported downstream
    return null;
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Perfil" },
            { label: "Configurar" },
          ]}
        />
        <SetupHeader isPro={isPro} />
        <PendingAlert at={pendingAt} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-4 lg:col-span-2">
            <SetupForm initial={{
              ...(profile ?? {}),
              // Strong defaults for name and avatar
              full_name: fullNameFallback,
              avatar_url: avatarUrlFallback,
              // prefer professionals' richer fields if available
              bio: (pro?.bio as any) ?? profile?.bio ?? null,
              headline: (pro?.headline as any) ?? profile?.headline ?? null,
              years_experience: (pro?.years_experience as any) ?? profile?.years_experience ?? null,
              city: (pro?.city as any) ?? profile?.city ?? null,
              cities: (Array.isArray((pro as any)?.cities) ? ((pro as any)?.cities as unknown as string[]) : null),
              // categories/subcategories from pro if present, else from profile
              categories: normalizeNamed((pro as any)?.categories ?? (profile as any)?.categories ?? null),
              subcategories: normalizeNamed((pro as any)?.subcategories ?? (profile as any)?.subcategories ?? null),
            } as any} onRequestChanges={createChangeRequest} />
          </Card>
          <Card className="p-4 space-y-2">
            <h2 className="text-sm font-medium">Consejos</h2>
            <ul className="text-sm text-slate-600 list-disc pl-4">
              <li>Las ciudades, categorías y subcategorías son los campos que utilizamos para mostrar los servicios que te pueden interesar, revisa que estos campos estén correctos.</li>
              <li>Usa una foto clara y profesional.</li>
              <li>Cuéntanos tu experiencia con ejemplos concretos.</li>
              <li>Agrega categorías y subcategorías relevantes.</li>
            </ul>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
