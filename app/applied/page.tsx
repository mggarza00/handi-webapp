import createClient from "@/utils/supabase/server";

import Breadcrumbs from "@/components/breadcrumbs";
import PageContainer from "@/components/page-container";
import { Card } from "@/components/ui/card";
import CompletedWorks from "@/components/profiles/CompletedWorks";
import { getProJobsWithPhotos } from "@/lib/profiles/jobs";

export const dynamic = "force-dynamic";

export default async function AppliedPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return (
      <PageContainer>
        <div>
          <Breadcrumbs
            items={[
              { label: "Inicio", href: "/" },
              { label: "Trabajos realizados" },
            ]}
          />
          <h1 className="mt-4 text-2xl font-semibold">Trabajos realizados</h1>
          <p className="mt-4 text-sm text-slate-700">
            Debes iniciar sesión para ver tus trabajos realizados.
          </p>
        </div>
      </PageContainer>
    );
  }

  // Cargar trabajos completados del profesional (con fotos por solicitud)
  const jobs = await getProJobsWithPhotos(supabase as any, user.id, 12);

  return (
    <PageContainer>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Trabajos realizados" },
          ]}
        />
        <header>
          <h1 className="text-2xl font-semibold">Trabajos realizados</h1>
          <p className="text-sm text-slate-600">Tus trabajos finalizados con evidencia.</p>
        </header>

        {jobs.length === 0 ? (
          <Card className="p-4 text-sm text-slate-600">Sin trabajos realizados aún</Card>
        ) : (
          <CompletedWorks
            items={jobs.map((j) => ({
              request_id: j.request_id,
              title: j.request_title || "Solicitud",
              photos: j.photos.map((u, i) => ({ id: `${j.request_id}-${i}`, url: u })),
            }))}
          />
        )}
      </div>
    </PageContainer>
  );
}
