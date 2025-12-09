import { redirect } from "next/navigation";

import SetupForm from "./setup.client";
import { createChangeRequest } from "./actions";

import Breadcrumbs from "@/components/breadcrumbs";
import PageContainer from "@/components/page-container";
import PendingAlert from "@/components/profile/PendingAlert";
import SetupHeader from "@/components/profile/SetupHeader";
import { Card } from "@/components/ui/card";
import createClient from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfessionalRow = Database["public"]["Tables"]["professionals"]["Row"];
type ChangeRequestRow = Database["public"]["Tables"]["profile_change_requests"]["Row"];
type SetupFormProps = Parameters<typeof SetupForm>[0];
type SetupFormInitial = SetupFormProps["initial"];

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
    .maybeSingle<ProfileRow>();

  // Load professional extra fields (cities) if present
  const { data: pro } = await supabase
    .from("professionals")
    .select("full_name, cities, city, headline, years_experience, bio, avatar_url, categories, subcategories")
    .eq("id", user.id)
    .maybeSingle<ProfessionalRow>();

  const isPro = profile?.role === "pro" || profile?.is_client_pro === true;

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
      .maybeSingle<Pick<ChangeRequestRow, "created_at">>();
    pendingAt = req?.created_at ?? null;
  } catch {
    pendingAt = null;
  }

  // Compute robust fallbacks for name and avatar (from professionals or auth metadata)
  const userMeta = (user.user_metadata ?? null) as Record<string, unknown> | null;
  const metaString = (key: string): string | null => {
    const value = userMeta?.[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  };

  const fullNameFallback =
    profile?.full_name ??
    pro?.full_name ??
    metaString("full_name") ??
    metaString("name") ??
    metaString("user_name") ??
    metaString("preferred_username") ??
    user.email ??
    null;

  const avatarUrlFallback =
    pro?.avatar_url ??
    profile?.avatar_url ??
    metaString("avatar_url") ??
    metaString("picture") ??
    null;

  const normalizeNamed = (raw: unknown): Array<{ name: string }> | null => {
    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          if (typeof item === "string") return { name: item };
          if (item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string") {
            return { name: ((item as { name?: string }).name as string).trim() };
          }
          return null;
        })
        .filter((entry): entry is { name: string } => Boolean(entry?.name?.length));
    }
    if (typeof raw === "string") {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
    }
    return null;
  };

  const proCities = Array.isArray(pro?.cities)
    ? (pro?.cities as unknown[])
        .filter((city): city is string => typeof city === "string" && city.trim().length > 0)
    : null;
  const proCategories = normalizeNamed(pro?.categories ?? profile?.categories ?? null);
  const proSubcategories = normalizeNamed(pro?.subcategories ?? profile?.subcategories ?? null);
  const setupInitial: SetupFormInitial = {
    full_name: fullNameFallback,
    avatar_url: avatarUrlFallback,
    headline: pro?.headline ?? profile?.headline ?? null,
    bio: pro?.bio ?? profile?.bio ?? null,
    years_experience: pro?.years_experience ?? profile?.years_experience ?? null,
    city: pro?.city ?? profile?.city ?? null,
    cities: proCities,
    categories: proCategories,
    subcategories: proSubcategories,
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
            <SetupForm initial={setupInitial} onRequestChanges={createChangeRequest} />
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
