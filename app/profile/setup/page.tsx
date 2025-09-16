import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import SetupForm from "./setup.client";

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
    return (
      <PageContainer>
        <div>
          <Breadcrumbs
            items={[
              { label: "Inicio", href: "/" },
              { label: "Perfil" },
              { label: "Configurar" },
            ]}
          />
          <h1 className="text-2xl font-semibold mt-4">
            Configura tu perfil profesional
          </h1>
          <p className="mt-4 text-sm text-slate-700">
            Necesitas iniciar sesión para continuar.
          </p>
        </div>
      </PageContainer>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, headline, bio, years_experience, city, categories, subcategories",
    )
    .eq("id", user.id)
    .maybeSingle();

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
            Configura tu perfil profesional
          </h1>
          <p className="text-sm text-slate-600">
            Estos datos ayudarán a los clientes a encontrarte.
          </p>
        </header>
        <SetupForm initial={profile ?? null} />
      </div>
    </PageContainer>
  );
}
