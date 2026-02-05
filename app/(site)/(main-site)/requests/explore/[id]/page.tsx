/* eslint-disable import/order */
import * as React from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
// import Image from "next/image"; // replaced by Avatar
import createClient from "@/utils/supabase/server";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
// Internal SSR helpers and client components
import { getRequestWithClient } from "../_lib/getRequestWithClient";
import ChatStartPro from "./chat-start-pro.client";
// Cross-app SSR helper
import { getConversationIdForRequest } from "@/app/(app)/mensajes/_lib/getConversationForRequest";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import RatingStars from "@/components/ui/RatingStars";
import PhotoGallery from "@/components/ui/PhotoGallery";
import { normalizeAvatarUrl } from "@/lib/avatar";
import { mapConditionToLabel } from "@/lib/conditions";
import { UI_STATUS_LABELS } from "@/lib/request-status";
import FinishJobTrigger from "@/components/services/FinishJobTrigger.client";
import { Building2, MapPin } from "lucide-react";

// Helpers para normalizar/mostrar fechas como dd-mm-aaaa
function normalizeDateInput(input?: string | null): string {
  if (!input) return "";
  const s = String(input);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
function formatDateDisplay(input?: string | null): string {
  const v = normalizeDateInput(input ?? "");
  if (!v) return "";
  const [y, m, d] = v.split("-");
  return `${d}-${m}-${y}`;
}

function formatCurrencyMXN(n: number | null): string | null {
  if (n == null) return null;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

type Params = { params: { id: string } };

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

export const dynamic = "force-dynamic";

export default async function ProRequestDetailPage({ params }: Params) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/requests/explore/${params.id}`);
  }

  // Require professional role
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();
  if ((prof?.role ?? null) !== "pro") {
    // If not a pro, send to home or own request page as applicable
    redirect(`/`);
  }

  const base = getBaseUrl();
  // Forward raw cookie header for SSR fetch
  const ck = cookies();
  const cookieHeader = ck
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${base}/api/requests/${params.id}`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    cache: "no-store",
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        No se encontrÃ³ la solicitud.
      </main>
    );
  }

  const d = j.data as Record<string, unknown>;

  // Normalize subcategory name (first)
  let subcategory = "";
  const subs = d.subcategories as unknown;
  if (Array.isArray(subs) && subs.length > 0) {
    const first = subs[0] as unknown;
    subcategory =
      typeof first === "string"
        ? first
        : ((first as { name?: string }).name ?? "");
  } else if (typeof (d as { subcategory?: unknown }).subcategory === "string") {
    subcategory = ((d as { subcategory?: string }).subcategory ?? "").trim();
  }

  // Build photos from attachments, signing when necessary
  const photos: Array<{ url: string; alt?: string | null }> = [];
  const atts = d.attachments as unknown;
  if (Array.isArray(atts)) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as
      | string
      | undefined;
    for (const raw of atts) {
      const f = raw as Record<string, unknown>;
      let href = (typeof f.url === "string" ? f.url : undefined) as
        | string
        | undefined;
      if (!href && typeof f.path === "string" && url && serviceRole) {
        try {
          const admin = createSupabaseJs(url, serviceRole);
          const s = await admin.storage
            .from("requests")
            .createSignedUrl(f.path as string, 60 * 60);
          href = s?.data?.signedUrl ?? undefined;
        } catch {
          /* ignore */
        }
      }
      if (href)
        photos.push({ url: href, alt: (f.mime as string | undefined) ?? null });
    }
  }

  const title = (d.title as string | null) ?? null;
  const city = (d.city as string | null) ?? null;
  const addressLine =
    typeof (d as { address_line?: unknown }).address_line === "string"
      ? ((d as { address_line?: string }).address_line as string)
      : null;
  const category = (d.category as string | null) ?? null;
  const description = (d.description as string | null) ?? null;
  const budget = typeof d.budget === "number" ? (d.budget as number) : null;
  const requiredAt = (d.required_at as string | null) ?? null;
  const status = (d.status as string | null) ?? null;
  const assignedProId = ((d as { accepted_professional_id?: string | null })
    .accepted_professional_id ??
    (d as { professional_id?: string | null }).professional_id ??
    null) as string | null;
  const canShowPrivateAddress =
    Boolean(user?.id && assignedProId && user.id === assignedProId) &&
    ["scheduled", "in_process", "paid"].includes((status || "").toLowerCase());
  const privateAddressLine = canShowPrivateAddress ? addressLine : null;
  const privateCity = canShowPrivateAddress ? city : null;
  const canFinish =
    Boolean(user?.id && assignedProId && user.id === assignedProId) &&
    (status === "scheduled" || status === "in_process");
  const conditions: string[] = ((d.conditions as string | undefined) || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 10);
  const _createdAt = (d.created_at as string | null) ?? null; // sin uso en UI
  // Usa helper con service role para obtener client_id y perfil (bypass RLS en server)
  const { client: clientFromAdmin } = await getRequestWithClient(params.id);
  const clientId =
    clientFromAdmin?.id ?? (d as { created_by?: string }).created_by ?? null;

  // Cargar perfil bÃ¡sico del cliente
  const supabaseS = createClient();
  let clientProfile: {
    id?: string;
    full_name: string | null;
    avatar_url: string | null;
    rating: number | null;
  } | null = clientFromAdmin
    ? {
        id: clientFromAdmin.id,
        full_name: clientFromAdmin.full_name,
        avatar_url: clientFromAdmin.avatar_url,
        rating: (clientFromAdmin as { rating?: number | null }).rating ?? null,
      }
    : null;
  if (!clientProfile && clientId) {
    const { data: cp } = await supabaseS
      .from("profiles")
      .select("id, full_name, avatar_url, rating")
      .eq("id", clientId)
      .maybeSingle();
    clientProfile = cp ?? null;
  }
  // Log temporal para QA
  // eslint-disable-next-line no-console
  console.log("[explore:client]", { clientId, hasProfile: !!clientProfile });

  const initials = (name?: string | null) =>
    (name ?? "Cliente")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => (s?.[0] ? s[0].toUpperCase() : ""))
      .join("") || "CL";

  const nombre = clientProfile?.full_name ?? "Cliente";
  const initialConversationId = await getConversationIdForRequest(params.id);

  // Obtener icono de subcategorÃ­a desde catÃ¡logo
  let subIcon: string | null = null;
  try {
    const catRes = await fetch(`${base}/api/catalog/categories`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });
    const cj = await catRes.json().catch(() => null);
    if (catRes.ok && cj?.ok && Array.isArray(cj.data)) {
      const rows: Array<{
        category?: string;
        subcategory?: string | null;
        icon?: string | null;
      }> = cj.data;
      const c = (category ?? "").trim();
      const s = (subcategory ?? "").trim();
      for (const r of rows) {
        const rc = String(r.category || "").trim();
        const rs = (r.subcategory ? String(r.subcategory) : "").trim();
        if (rc === c && rs === s) {
          subIcon = (r.icon ?? null) as string | null;
          break;
        }
      }
    }
  } catch {
    /* ignore */
  }

  const statusLabel =
    status && Object.hasOwn(UI_STATUS_LABELS, status)
      ? UI_STATUS_LABELS[status as keyof typeof UI_STATUS_LABELS]
      : status;

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <nav className="text-sm text-slate-600">
        <Link href="/" className="hover:underline">
          Inicio
        </Link>{" "}
        /{" "}
        <Link href="/requests/explore" className="hover:underline">
          Trabajos disponibles
        </Link>{" "}
        /{" "}
        <span className="text-slate-900 font-medium">
          {title ?? "Solicitud"}
        </span>
      </nav>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{title ?? "Solicitud"}</h1>
            {canFinish ? (
              <FinishJobTrigger
                requestId={String(d.id ?? params.id)}
                requestTitle={title}
                requestStatus={status}
                clientId={clientId ?? null}
                clientName={clientProfile?.full_name ?? null}
                proId={user?.id ?? null}
                buttonLabel="Trabajo finalizado"
                buttonVariant="outline"
              />
            ) : null}
          </div>
          {/* Condiciones: chips bajo el tÃ­tulo, sin tarjeta, sin texto "Condiciones" */}
          {conditions.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {conditions.map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                  title={c}
                  aria-label={c}
                >
                  {mapConditionToLabel(c)}
                </span>
              ))}
            </div>
          ) : null}
          {/* Cliente: en mobile mostrar debajo del tÃ­tulo */}
          <Card className="p-4 md:hidden">
            <h2 className="font-medium">Cliente</h2>
            <div className="flex items-center gap-3 mt-3">
              <Avatar className="h-12 w-12">
                {clientProfile?.avatar_url ? (
                  <AvatarImage
                    src={
                      normalizeAvatarUrl(clientProfile.avatar_url) ||
                      "/images/Favicon-v1-jpeg.jpg"
                    }
                    alt={nombre}
                  />
                ) : (
                  <AvatarFallback>
                    {initials(clientProfile?.full_name)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium leading-none truncate">
                    {nombre}
                  </div>
                  {(clientProfile?.id ?? clientId) ? (
                    <Link
                      href={`/clients/${clientProfile?.id ?? clientId}`}
                      className="text-xs underline hover:no-underline text-slate-600"
                    >
                      ver perfil y reseÃ±as
                    </Link>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {typeof clientProfile?.rating === "number" ? (
                    <RatingStars
                      value={clientProfile.rating}
                      className="text-[12px]"
                    />
                  ) : (
                    <span>CalificaciÃ³n: â€”</span>
                  )}
                </div>
                {privateAddressLine || privateCity ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {privateAddressLine ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{privateAddressLine}</span>
                      </div>
                    ) : null}
                    {privateCity ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate">{privateCity}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="pt-2">
              <ChatStartPro
                requestId={String(d.id ?? params.id)}
                initialConversationId={initialConversationId}
              />
            </div>
          </Card>
          {/* Info en tarjetas (mismo diseÃ±o que /requests/[id]) */}
          <div className="space-y-4">
            <Card className="p-4">
              <Field label="DescripciÃ³n" value={description} multiline />
            </Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-4">
                <Field label="Estado" value={statusLabel} />
              </Card>
              <Card className="p-4">
                <Field label="Ciudad" value={city} />
              </Card>
              <Card className="p-4">
                <Field label="CategorÃ­a" value={category} />
              </Card>
              <Card className="p-4">
                <div>
                  <div className="text-xs text-slate-500">SubcategorÃ­a</div>
                  <div className="text-sm text-slate-700 inline-flex items-center gap-2">
                    {subIcon ? (
                      subIcon.startsWith("http") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={subIcon}
                          alt=""
                          className="h-4 w-4 object-contain"
                        />
                      ) : (
                        <span className="text-sm leading-none">{subIcon}</span>
                      )
                    ) : null}
                    <span>{subcategory || "â€”"}</span>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <Field
                  label="Presupuesto (MXN)"
                  value={formatCurrencyMXN(budget)}
                />
              </Card>
              <Card className="p-4">
                <Field
                  label="Fecha requerida"
                  value={formatDateDisplay(requiredAt)}
                />
              </Card>
              {/* Condiciones se muestran arriba bajo el tÃ­tulo */}
            </div>
          </div>
          {photos.length > 0 ? <PhotoGallery photos={photos} /> : null}
        </div>

        <aside className="space-y-4">
          <Card className="p-4 space-y-3 hidden md:block">
            <h2 className="font-medium">Cliente</h2>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {clientProfile?.avatar_url ? (
                  <AvatarImage
                    src={
                      normalizeAvatarUrl(clientProfile.avatar_url) ||
                      "/images/Favicon-v1-jpeg.jpg"
                    }
                    alt={nombre}
                  />
                ) : (
                  <AvatarFallback>
                    {initials(clientProfile?.full_name)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium leading-none truncate">
                    {nombre}
                  </div>
                  {(clientProfile?.id ?? clientId) ? (
                    <Link
                      href={`/clients/${clientProfile?.id ?? clientId}`}
                      className="text-xs underline hover:no-underline text-slate-600"
                    >
                      ver perfil y reseÃ±as
                    </Link>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {typeof clientProfile?.rating === "number" ? (
                    <RatingStars
                      value={clientProfile.rating}
                      className="text-[12px]"
                    />
                  ) : (
                    <span>CalificaciÃ³n: â€”</span>
                  )}
                </div>
                {privateAddressLine || privateCity ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {privateAddressLine ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{privateAddressLine}</span>
                      </div>
                    ) : null}
                    {privateCity ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate">{privateCity}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="pt-2">
              <ChatStartPro
                requestId={String(d.id ?? params.id)}
                initialConversationId={initialConversationId}
              />
            </div>
          </Card>
          {/* Se eliminÃ³ Postularme; acciones se integran en el chat */}
        </aside>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value?: string | number | null;
  multiline?: boolean;
}) {
  const v = value == null || value === "" ? "â€”" : String(value);
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      {multiline ? (
        <p className="text-sm text-slate-700 whitespace-pre-line leading-6">
          {v}
        </p>
      ) : (
        <div className="text-sm text-slate-700">{v}</div>
      )}
    </div>
  );
}
