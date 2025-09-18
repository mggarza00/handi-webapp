import Link from "next/link";
import { cookies, headers } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MatchItem = {
  request_id: string;
  title: string | null;
  city: string | null;
  category: string | null;
  subcategories: string[];
  created_at: string;
  score: number;
  reasons: string[];
  source: "profile_match" | "application" | "agreement";
};

type MatchesResponse = {
  ok: boolean;
  data?: {
    matches: MatchItem[];
    profile: {
      id: string;
      full_name: string | null;
      headline: string | null;
      active: boolean | null;
      city: string | null;
      last_active_at: string | null;
      filters: {
        cities: number;
        categories: number;
        subcategories: number;
      };
    } | null;
  };
  error?: string;
};

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (host ? `${proto}://${host}` : "http://localhost:3000")
  );
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatRelative(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "recien";
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "recien";
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} d`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} mes`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} anios`;
}

async function fetchMatches() {
  const base = getBaseUrl();
  const ck = cookies();
  const cookieHeader = ck
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  try {
    const res = await fetch(`${base}/api/pro/matches`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as MatchesResponse;
    if (!res.ok || !json.ok || !json.data) {
      const message = json.error || `Error ${res.status}`;
      return { ok: false as const, error: message };
    }
    return {
      ok: true as const,
      matches: json.data.matches,
      profile: json.data.profile,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

export default async function Dashboard() {
  const { ok, matches, profile, error } = await fetchMatches();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Panel</h2>
          <p className="text-sm text-muted-foreground">
            Revisa coincidencias recientes con tu perfil profesional.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/profile/setup">Actualizar perfil</Link>
        </Button>
      </div>

      {!ok ? (
        <Card>
          <CardHeader>
            <CardTitle>No fue posible cargar los matches</CardTitle>
            <CardDescription>{error || "Intenta nuevamente en unos minutos."}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {ok && !profile ? (
        <Card>
          <CardHeader>
            <CardTitle>Configura tu perfil</CardTitle>
            <CardDescription>
              Necesitas completar tu informacion profesional para recibir coincidencias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/profile/setup">Ir a configuracion</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {ok && profile ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Matches sugeridos</CardTitle>
                <CardDescription>Solicitudes activas compatibles.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{matches?.length ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Filtros activos</CardTitle>
                <CardDescription>Categorias, subcategorias y ciudades configuradas.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span>{profile.filters.categories} categorias</span>
                  <span>{profile.filters.subcategories} subcategorias</span>
                  <span>{profile.filters.cities} ciudades</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ultima actividad</CardTitle>
                <CardDescription>
                  {profile.last_active_at ? formatRelative(profile.last_active_at) : "Sin registro"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {profile.last_active_at ? formatDate(profile.last_active_at) : "Actualiza tu perfil"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Coincidencias recientes</CardTitle>
              <CardDescription>
                Mostramos hasta 20 solicitudes activas con mayor puntaje de compatibilidad.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {matches && matches.length > 0 ? (
                <ul className="space-y-4">
                  {matches.map((match) => (
                    <li key={match.request_id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <Link href={`/requests/${match.request_id}`} className="text-base font-semibold hover:underline">
                            {match.title ?? "Solicitud sin titulo"}
                          </Link>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {match.category ? <Badge variant="secondary">{match.category}</Badge> : null}
                            {match.city ? <Badge variant="outline">{match.city}</Badge> : null}
                            <span>Publicada {formatRelative(match.created_at)}</span>
                          </div>
                        </div>
                        <Badge>{Math.max(0, Math.round(match.score))}</Badge>
                      </div>
                      {match.reasons.length > 0 ? (
                        <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {match.reasons.map((reason, index) => (
                            <li key={`${match.request_id}-reason-${index}`} className="rounded bg-muted px-2 py-1">
                              {reason}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {match.subcategories.length > 0 ? (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Subcategorias: {match.subcategories.join(", ")}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No encontramos coincidencias con tus filtros actuales. Revisa tus categorias o ciudades en el perfil.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
