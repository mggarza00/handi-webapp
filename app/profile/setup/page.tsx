import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import SetupForm from "./setup.client";
import { createChangeRequest } from "./actions";

import Breadcrumbs from "@/components/breadcrumbs";
import PageContainer from "@/components/page-container";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function ProfileSetupPage() {
  const supabase = createServerComponentClient<Database>({ cookies });
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
    .maybeSingle();

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
      .maybeSingle();
    pendingAt = (req?.created_at as string | null) ?? null;
  } catch {
    pendingAt = null;
  }

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
        <header>
          <h1 className="text-2xl font-semibold">
            {isPro ? "Configura tu perfil de profesional" : "Configura tu perfil"}
          </h1>
          <p className="text-sm text-slate-600">
            Tus cambios serán revisados por el equipo antes de publicarse.
          </p>
        </header>
        {pendingAt ? (
          <div className="rounded-2xl border bg-yellow-50 text-yellow-900 p-4">
            Tienes una solicitud pendiente desde {new Date(pendingAt).toLocaleString()}.
          </div>
        ) : null}
        <SetupForm initial={profile ?? null} onRequestChanges={createChangeRequest} />
      </div>
    </PageContainer>
  );
}

