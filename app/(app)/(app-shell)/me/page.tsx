import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { normalizeAvatarUrl } from "@/lib/avatar";
import { getClientData } from "@/lib/clients/get-client-data";
import createClient from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/auth/sign-in");

  const data = await getClientData(user.id);
  const profile = data.profile;

  const displayName =
    toText(profile?.full_name)?.trim() ||
    toText((user.user_metadata as Record<string, unknown> | null)?.full_name) ||
    "Cliente";
  const avatarUrl = normalizeAvatarUrl(
    toText(profile?.avatar_url) ??
      toText(
        (user.user_metadata as Record<string, unknown> | null)?.avatar_url,
      ) ??
      null,
  );
  const joinedLabel = formatDate(
    toText(profile?.created_at),
    "Fecha de alta no disponible",
  );

  const requests = data.requests || [];
  const totalRequests = requests.length;
  const activeRequests = requests.filter((r) =>
    isRequestActive(toText(r.status)),
  ).length;
  const closedRequests = totalRequests - activeRequests;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl || "/avatar.png"}
              alt={displayName}
              className="h-20 w-20 rounded-full border object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-slate-900">
                {displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Cliente</Badge>
                <span className="text-sm text-slate-600">{joinedLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <Button asChild>
              <Link href="/profile/setup">Editar perfil</Link>
            </Button>
            <p className="text-xs text-slate-600 md:text-right">
              Actualiza tu información y envía cambios para revisión.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[340px,minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="rounded-2xl border bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Información general</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Email" value={user.email || "No disponible"} />
              <InfoRow
                label="Ciudad"
                value={toText(profile?.city) || "Sin ciudad"}
              />
              <InfoRow
                label="Bio"
                value={
                  toText(profile?.bio) &&
                  toText(profile?.bio)!.trim().length > 0
                    ? toText(profile?.bio)!
                    : "Aún no agregas una descripción."
                }
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-center">
              <StatBox label="Solicitudes" value={totalRequests} />
              <StatBox label="Activas" value={activeRequests} />
              <StatBox label="Cerradas" value={closedRequests} />
              <StatBox
                label="Promedio"
                value={
                  data.ratingSummary.average != null
                    ? data.ratingSummary.average.toFixed(1)
                    : "-"
                }
                helper={`${data.ratingSummary.count} reseñas`}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Solicitudes de servicio</CardTitle>
              <CardDescription>
                Historial de solicitudes creadas por tu perfil cliente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <EmptyState text="Aún no tienes solicitudes publicadas." />
              ) : (
                <ul className="space-y-3">
                  {requests.slice(0, 12).map((request, idx) => {
                    const requestId = toText(request.id) || "";
                    const requestTitle = toText(request.title) || "Solicitud";
                    const requestDescription =
                      toText(request.description)?.trim() || "Sin descripción";
                    const requestStatus = toText(request.status);
                    const requestCity = toText(request.city) || "Sin ciudad";
                    const requestCategory =
                      toText(request.category) || "Sin categoría";
                    return (
                      <li
                        key={requestId || `req-${idx}`}
                        className="rounded-xl border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-slate-900">
                            {requestTitle}
                          </p>
                          <Badge variant={requestBadgeVariant(requestStatus)}>
                            {requestStatusLabel(requestStatus)}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {requestDescription}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>
                            {formatDate(
                              toText(request.required_at) ??
                                toText(request.created_at),
                              "Sin fecha",
                            )}
                          </span>
                          <span>•</span>
                          <span>{requestCity}</span>
                          <span>•</span>
                          <span>{requestCategory}</span>
                        </div>
                        <div className="mt-3">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/requests/${requestId}`}>
                              Ver solicitud
                            </Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Reseñas recibidas</CardTitle>
              <CardDescription>
                Comentarios que profesionales han dejado sobre ti como cliente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentReviews.length === 0 ? (
                <EmptyState text="Aún no tienes reseñas de profesionales." />
              ) : (
                <ul className="space-y-3">
                  {data.recentReviews.map((review, idx) => (
                    <li
                      key={toText(review.id) || `review-${idx}`}
                      className="rounded-xl border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-900">
                          {renderStars(toNumber(review.rating))}
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatDate(toText(review.created_at), "Sin fecha")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        {toText(review.comment)?.trim() || "Sin comentario"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {toText(review.request_title) ||
                          (toText(review.request_id)
                            ? `Solicitud ${toText(review.request_id)}`
                            : "Sin solicitud")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-slate-900">{value}</p>
    </div>
  );
}

function StatBox({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border bg-slate-50 px-3 py-3">
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-600">{label}</p>
      {helper ? <p className="text-[11px] text-slate-500">{helper}</p> : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-slate-50 px-4 py-3 text-sm text-slate-600">
      {text}
    </div>
  );
}

function requestStatusLabel(status: string | null): string {
  switch (status) {
    case "active":
      return "Activa";
    case "completed":
      return "Completada";
    case "cancelled":
      return "Cancelada";
    case "closed":
      return "Cerrada";
    default:
      return status || "Sin estado";
  }
}

function toText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function requestBadgeVariant(
  status: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed" || status === "closed") return "secondary";
  if (status === "cancelled") return "destructive";
  if (status === "active") return "default";
  return "outline";
}

function isRequestActive(status: string | null): boolean {
  return status === "active" || status === "pending" || status === "open";
}

function formatDate(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function renderStars(value: number | null): string {
  const rating =
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)} (${rating.toFixed(1)})`;
}
