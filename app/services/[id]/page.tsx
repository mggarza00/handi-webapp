import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import Breadcrumbs from "@/components/breadcrumbs";
import { getUserOrThrow } from "@/lib/_supabase-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Database } from "@/types/supabase";
// ConfirmServiceButton se usa a través de ConfirmAndReview (client wrapper)
import ConfirmAndReview from "@/components/services/ConfirmAndReview.client";
import JobPhotosUploader from "@/components/services/JobPhotosUploader.client";
import createClient from "@/utils/supabase/server";

type Params = { params: { id: string } };

type AgreementRow = Database["public"]["Tables"]["agreements"]["Row"];
type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
type ServicePhotoRow = Database["public"]["Tables"]["service_photos"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type ServiceContext = {
  service: AgreementRow;
  request: RequestRow | null;
  photos: ServicePhotoRow[];
};

export const dynamic = "force-dynamic";

async function loadServiceContext(
  supabase: SupabaseClient<Database>,
  serviceId: string,
  professionalId: string,
): Promise<ServiceContext | null> {
  const { data: service } = await supabase
    .from("agreements")
    .select(
      "id, request_id, professional_id, amount, status, completed_by_pro, completed_by_client, completed_at, created_at, updated_at",
    )
    .eq("id", serviceId)
    .eq("professional_id", professionalId)
    .maybeSingle<AgreementRow>();

  if (!service) {
    return null;
  }

  let request: RequestRow | null = null;
  if (service.request_id) {
    const { data: requestRow } = await supabase
      .from("requests")
      .select(
        "id, title, description, city, category, subcategories, budget, required_at, created_at, status, created_by",
      )
      .eq("id", service.request_id)
      .maybeSingle<RequestRow>();
    request = requestRow ?? null;
  }

  let photos: ServicePhotoRow[] = [];
  if (service.request_id && service.professional_id) {
    const { data: photoRows } = await supabase
      .from("service_photos")
      .select("id, image_url, uploaded_at")
      .eq("request_id", service.request_id)
      .eq("professional_id", service.professional_id)
      .order("uploaded_at", { ascending: false })
      .limit(6);
    photos = photoRows ?? [];
  }

  return {
    service,
    request,
    photos,
  };
}

function normalizeStatus(
  status: AgreementRow["status"],
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (status) {
    case "completed":
      return { label: "Completado", variant: "secondary" };
    case "in_progress":
      return { label: "En progreso", variant: "default" };
    case "accepted":
      return { label: "Aceptado", variant: "outline" };
    case "cancelled":
      return { label: "Cancelado", variant: "destructive" };
    case "paid":
      return { label: "Pagado", variant: "secondary" };
    case "negotiating":
      return { label: "En negociacion", variant: "outline" };
    case "disputed":
      return { label: "En disputa", variant: "destructive" };
    default:
      return { label: "Sin estado", variant: "outline" };
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "Sin definir";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ServiceDetailPage({ params }: Params) {
  const client = createClient();
  const { supabase, user } = await getUserOrThrow(client).catch(() => {
    redirect(`/login?next=/services/${params.id}`);
  });

  const { data: proProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!proProfile || proProfile.role !== "pro") {
    redirect("/");
  }

  const context = await loadServiceContext(supabase, params.id, user.id);
  if (!context) {
    notFound();
  }

  const status = normalizeStatus(context.service.status);
  const hasConfirmed = Boolean(context.service.completed_by_pro);
  const buttonWaitingFor = context.service.completed_by_client ? null : "cliente";
  // El modal de reseñas se gestiona en el cliente (ConfirmAndReview)
  const requestTitle = context.request?.title ?? `Servicio ${context.service.id}`;
  const breadcrumbs = [
    { label: "Inicio", href: "/" },
    { label: "Servicios", href: "/services" },
    { label: requestTitle },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <Breadcrumbs items={breadcrumbs} />
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">Gestion profesional</p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {requestTitle}
          </h1>
          <p className="text-sm text-slate-600">
            Cierra el servicio, registra la calificacion y adjunta evidencias.
          </p>
        </div>
        <Badge variant={status.variant} data-testid="status-chip">{status.label}</Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Servicio en curso</CardTitle>
              <CardDescription>
                Estado actual del servicio y datos relevantes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <div className="rounded border bg-white p-4 shadow-sm">
                <div className="space-y-2">
                  <p>
                    <strong>Titulo:</strong> {context.request?.title ?? "Sin titulo"}
                  </p>
                  <p>
                    <strong>Presupuesto:</strong> {formatCurrency(context.request?.budget)}
                  </p>
                  <p>
                    <strong>Fecha requerida:</strong> {formatDate(context.request?.required_at)}
                  </p>
                </div>
                <div className="mt-4">
                  <ConfirmAndReview
                    agreementId={context.service.id}
                    requestId={context.service.request_id ?? params.id}
                    professionalId={context.service.professional_id}
                    clientId={context.request?.created_by ?? ""}
                    viewerId={user.id}
                    initialStatus={context.service.status ?? null}
                    hasConfirmed={context.service.completed_by_pro ?? false}
                    waitingFor={buttonWaitingFor}
                    className="w-full"
                  />
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {context.service.status === "completed"
                    ? "Ambas partes confirmaron este servicio."
                    : hasConfirmed
                    ? "Esperando la confirmacion del cliente."
                    : "Confirma el cierre cuando hayas terminado."}
                </div>
                {context.service.status !== "completed" ? (
                  <p className="text-xs text-slate-500">
                    Usa el boton para confirmar cuando hayas terminado.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidencias de trabajo</CardTitle>
              <CardDescription>
                Adjunta fotos o recibos antes de cerrar el servicio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {context.photos.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {context.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-video rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500"
                    >
                      <p className="font-medium">Foto subida</p>
                      <p className="mt-1 break-words text-[11px]">
                        {photo.image_url}
                      </p>
                      <p className="mt-2 text-[11px]">
                        {formatDate(photo.uploaded_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                  Aqui veras las evidencias una vez que se integren los componentes de subida.
                </div>
              )}
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                <JobPhotosUploader
                  requestId={context.service.request_id ?? params.id}
                  professionalId={context.service.professional_id}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cierre del servicio</CardTitle>
              <CardDescription>
                Confirma la entrega y informa al cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" disabled>
                Cerrar servicio (proximo)
              </Button>
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Aqui vivira el formulario para confirmar la finalizacion.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calificacion del cliente</CardTitle>
              <CardDescription>
                Registra la experiencia cuando este disponible.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="secondary" disabled>
                Calificar cliente (proximo)
              </Button>
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Placeholder para el componente de rating y notas.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas internas</CardTitle>
              <CardDescription>
                Guarda informacion clave para tu historial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Espacio reservado para notas privadas del profesional.
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
      {/* Modal de reseña se renderiza dentro de ConfirmAndReview */}
    </main>
);
}
