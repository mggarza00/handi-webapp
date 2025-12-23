import * as React from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import localFont from "next/font/local";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MapPin } from "lucide-react";

import Breadcrumbs from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import FavoriteProButton from "@/components/profiles/FavoriteProButton.client";
import CertChip from "@/components/profiles/CertChip";
import PhotoMasonry from "@/components/profiles/PhotoMasonry";
import CompletedWorks from "@/components/profiles/CompletedWorks";
import ExpandableText from "@/components/profiles/ExpandableText.client";
import ReviewsListClient from "@/components/profiles/ReviewsList.client";
import StarRating from "@/components/StarRating";
import "./profile-layout.css";

import type { Database } from "@/types/supabase";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  getProfessionalOverview,
  getPortfolio as loadPortfolio,
  getReviews as loadReviews,
} from "@/lib/profiles/data";
import { getProJobsWithPhotos } from "@/lib/profiles/jobs";
import createClient from "@/utils/supabase/server";

const stackSansHeading = localFont({
  src: "../../../public/fonts/Stack_Sans_Text/static/StackSansText-SemiBold.ttf",
  weight: "600",
  display: "swap",
});

type Ctx = { params: { id: string } };

type ReviewDTO = {
  id: string;
  stars: number;
  comment?: string;
  createdAt: string;
  clientName?: string;
  clientAvatarUrl?: string;
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

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const base = getBaseUrl();
  try {
    const supa = getAdminSupabase() as SupabaseClient<Database>;
    const ov = await getProfessionalOverview(supa, params.id);
    const name =
      ((ov.pro as any)?.profiles?.full_name as string) ||
      (ov.pro as any)?.full_name ||
      "Perfil profesional";
    const rawBio = (((ov.pro as any)?.bio as string) || "").toString();
    const firstLine = rawBio.split(/\r?\n/)[0] || "";
    const bioText = firstLine;
    const titleName = `${name} Perfil profesional`;
    const desc =
      bioText.length > 160
        ? `${bioText.slice(0, 157)}…`
        : bioText || "Perfil profesional en Handi";

    // Prefer avatar as OG if available, else fallback
    let imageUrl = (((ov.pro as any)?.profiles?.avatar_url as string) ||
      (ov.pro as any)?.avatar_url ||
      `${base}/avatar.png`) as string;

    return {
      title: `${titleName} · Handi`,
      description: desc,
      openGraph: {
        title: `${titleName} · Handi`,
        description: desc,
        url: `${base}/profiles/${params.id}`,
        images: [imageUrl],
        siteName: "Handi",
        type: "profile",
      },
      twitter: {
        card: "summary_large_image",
        title: `${titleName} · Handi`,
        description: desc,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: "Perfil · Handi" };
  }
}

export default async function PublicProfilePage({ params }: Ctx) {
  const supa = getAdminSupabase() as SupabaseClient<Database>;
  const proId = params.id;

  // 1) Perfil + métricas
  const overview = await getProfessionalOverview(supa, proId);
  const pro = overview.pro;
  if (!pro) {
    // Si no existe perfil público y el usuario autenticado es el dueño, redirige a setup
    try {
      const rls = createClient();
      const { data: auth } = await rls.auth.getUser();
      if (auth?.user?.id === proId) {
        redirect("/profile/setup");
      }
    } catch {
      // ignore
    }
    return notFound();
  }

  // Small helpers to normalize arrays stored as JSON/string
  const toArray = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      const s = v.trim();
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed as unknown[];
      } catch {
        /* ignore */
      }
      return s ? [s] : [];
    }
    return [];
  };
  const toNames = (v: unknown): string[] =>
    toArray(v)
      .map((x) => (typeof x === "string" ? x : (x as any)?.name))
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .map((s) => s.trim());

  const categories = overview.categories;
  const subcategories = overview.subcategories;

  // Helpers
  async function getPortfolio(id: string, limit = 18) {
    const { data } = await supa
      .from("service_photos")
      .select("id, request_id, image_url, uploaded_at")
      .eq("professional_id", id)
      .order("uploaded_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    const photos = (data ?? []) as Array<
      Database["public"]["Tables"]["service_photos"]["Row"]
    >;
    const reqIds = Array.from(new Set(photos.map((p) => p.request_id))).filter(
      Boolean,
    ) as string[];
    let titles = new Map<string, string>();
    if (reqIds.length) {
      const rq = await supa
        .from("requests")
        .select("id, title")
        .in("id", reqIds);
      const rows = (rq.data ?? []) as Array<
        Database["public"]["Tables"]["requests"]["Row"]
      >;
      titles = new Map(rows.map((r) => [r.id, r.title]));
    }
    return photos.map((x) => ({
      url: x.image_url,
      requestId: x.request_id,
      title: titles.get(x.request_id) || undefined,
      createdAt: x.uploaded_at || undefined,
    }));
  }

  async function getReviews(
    id: string,
    limit = 10,
  ): Promise<{
    items: ReviewDTO[];
    count: number;
    nextCursor: string | null;
    average: number | null;
  }> {
    const [{ data: list }, { count }, avg] = await Promise.all([
      // Prefer view with client info if available
      supa
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("v_professional_reviews" as any)
        .select("id, rating, comment, created_at, client_name, client_avatar")
        .eq("professional_id", id)
        .order("created_at", { ascending: false })
        .limit(limit),
      supa
        .from("ratings")
        .select("id", { count: "exact", head: true })
        .eq("to_user_id", id),
      supa
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("ratings" as any)
        .select("avg:stars")
        .eq("to_user_id", id),
    ]);
    const items: ReviewDTO[] = (list ?? []).map((r: any) => ({
      id: String(r.id),
      stars: Number(r.rating ?? 0),
      comment: (r.comment as string | null) || undefined,
      createdAt: (r.created_at as string | null) || "",
      clientName: (r.client_name as string | null) || undefined,
      clientAvatarUrl: (r.client_avatar as string | null) || undefined,
    }));
    const nextCursor = items.length
      ? `${items[items.length - 1].createdAt}|${items[items.length - 1].id}`
      : null;
    let average: number | null = null;
    try {
      if (Array.isArray(avg.data) && avg.data.length > 0) {
        const v = (avg.data[0] as any)?.avg;
        average = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(average)) average = null;
      }
    } catch {
      /* ignore */
    }
    return { items, count: count ?? 0, nextCursor, average };
  }

  const [portfolio, reviewsData] = await Promise.all([
    loadPortfolio(supa, proId, 18),
    loadReviews(supa, proId, 5),
  ]);

  // Jobs with photos list (distinct requests completed by this pro)
  const jobsWithPhotos = await getProJobsWithPhotos(supa, proId, 6);

  // Determine if viewer should see Favorite button: only for logged-in clients viewing other profiles
  const rls = createClient();
  const { data: auth } = await rls.auth.getUser();
  let showFavorite = false;
  if (auth?.user) {
    const uid = auth.user.id;
    if (uid !== proId) {
      const { data: viewerProfile } = await rls
        .from("profiles")
        .select("id, role")
        .eq("id", uid)
        .maybeSingle<any>();
      const vrole =
        ((viewerProfile as any)?.role as null | "client" | "pro" | "admin") ??
        null;
      showFavorite = vrole === "client";
    }
  }

  // Jobs done (completed agreements)
  const jobsDone = overview.jobsDone;

  // Certifications (best-effort, optional column)
  let certifications: string[] = [];
  try {
    const prow = await supa
      .from("professionals")
      .select("id, certifications")
      .eq("id", proId)
      .maybeSingle();
    const raw = (prow.data as unknown as { certifications?: unknown } | null)
      ?.certifications;
    const toArray = (v: unknown): unknown[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        const s = v.trim();
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed as unknown[];
        } catch {}
        if (s.includes(","))
          return s
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
        return s ? [s] : [];
      }
      return [];
    };
    certifications = toArray(raw)
      .map((x) => (typeof x === "string" ? x : (x as any)?.name))
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .map((s) => s.trim());
  } catch {
    /* ignore */
  }

  const displayName =
    ((pro as any)?.profiles?.full_name as string) ||
    ((pro as any)?.full_name as string) ||
    "Profesional";
  const avatarUrl =
    ((pro as any)?.profiles?.avatar_url as string) ||
    ((pro as any)?.avatar_url as string) ||
    "/avatar.png";
  const cityLabel =
    ((pro as any)?.profiles?.city as string) ||
    ((pro as any)?.city as string) ||
    null;
  const categoriesLabel =
    (categories.length ? categories : subcategories).join(", ") || "—";
  const subcategoriesLabel = subcategories.join(", ") || "—";
  const serviceCities = overview.cities ?? [];
  const yearsExperience =
    typeof (pro as any)?.years_experience === "number"
      ? ((pro as any)?.years_experience as number)
      : null;
  const averageRating =
    typeof reviewsData.average === "number"
      ? reviewsData.average
      : typeof (pro as any)?.rating === "number"
        ? ((pro as any)?.rating as number)
        : null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Profesionales", href: "/professionals" },
          { label: displayName || "Perfil" },
        ]}
      />

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-primary)] text-white shadow-2xl">
        <div className="flex flex-col gap-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl || "/avatar.png"}
                alt={displayName}
                className="h-20 w-20 rounded-full bg-white p-1 ring-2 ring-white/50 object-cover shadow-lg md:h-24 md:w-24"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                loading="lazy"
                decoding="async"
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1
                    className={`${stackSansHeading.className} text-3xl font-semibold leading-tight text-white`}
                  >
                    {displayName}
                  </h1>
                  <Badge
                    variant="default"
                    className="bg-white/15 text-white ring-1 ring-white/20"
                  >
                    Profesional
                  </Badge>
                  {((pro as any)?.verified as boolean | null) ||
                  ((pro as any)?.is_featured as boolean | null) ? (
                    <Badge
                      variant="outline"
                      className="border-white/30 bg-white/10 text-white"
                    >
                      Verificado
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/85">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {cityLabel || "Ubicación no disponible"}
                  </span>
                  {typeof yearsExperience === "number" ? (
                    <span className="inline-flex items-center gap-1">
                      • {yearsExperience} años de experiencia
                    </span>
                  ) : null}
                  {typeof jobsDone === "number" ? (
                    <span className="inline-flex items-center gap-1">
                      • {jobsDone} trabajos realizados
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/90">
                  {typeof averageRating === "number" ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                      <StarRating
                        value={averageRating}
                        ariaLabel={`Calificación ${averageRating.toFixed(1)} de 5`}
                      />
                      <span className="font-semibold">
                        {averageRating.toFixed(1)}
                      </span>
                      {typeof reviewsData.count === "number" ? (
                        <span className="text-white/80">
                          ({reviewsData.count} reseñas)
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {showFavorite ? (
              <div className="self-start md:self-center">
                <FavoriteProButton proId={proId} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-white/90">
            {categoriesLabel && categoriesLabel !== "—" ? (
              <span className="rounded-full bg-white/10 px-3 py-1">
                {categoriesLabel}
              </span>
            ) : null}
            {serviceCities.map((c) => (
              <span key={c} className="rounded-full bg-white/10 px-3 py-1">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="profile-layout">
        <div className="space-y-4">
          <Card className="rounded-2xl border bg-white shadow-sm">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Información general
              </h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-600">
                <InfoRow
                  label="Años de experiencia"
                  value={
                    typeof yearsExperience === "number"
                      ? `${yearsExperience} años`
                      : "—"
                  }
                />
                <InfoRow
                  label="Trabajos finalizados"
                  value={
                    typeof jobsDone === "number" ? jobsDone.toString() : "—"
                  }
                />
                <InfoRow
                  label="Calificación promedio"
                  value={
                    typeof averageRating === "number"
                      ? `${averageRating.toFixed(1)} / 5`
                      : "—"
                  }
                />
                <InfoRow label="Ciudad" value={cityLabel ?? "—"} />
                <InfoRow label="Categorías" value={categoriesLabel || "—"} />
                <InfoRow
                  label="Subcategorías"
                  value={subcategoriesLabel || "—"}
                />
                <InfoRow
                  label="Ciudades de servicio"
                  value={
                    serviceCities.length
                      ? serviceCities.join(", ")
                      : "Sin ciudades adicionales"
                  }
                />
              </dl>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-white shadow-sm">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-slate-900">Resumen</h2>
              <div className="mt-3 text-sm text-slate-600">
                {pro.bio ? (
                  <ExpandableText
                    text={(pro.bio as string) || ""}
                    maxParagraphs={35}
                    previewParagraphs={4}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aún no agregas una bio como profesional.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-white shadow-sm">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Estadísticas
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-700">
                <StatPill
                  label="Calificación"
                  value={
                    typeof averageRating === "number"
                      ? averageRating.toFixed(1)
                      : "—"
                  }
                />
                <StatPill
                  label="Trabajos"
                  value={
                    typeof jobsDone === "number" ? jobsDone.toString() : "—"
                  }
                />
                <StatPill
                  label="Años exp."
                  value={
                    typeof yearsExperience === "number"
                      ? yearsExperience.toString()
                      : "—"
                  }
                />
                <StatPill
                  label="Reseñas"
                  value={
                    typeof reviewsData.count === "number"
                      ? reviewsData.count.toString()
                      : "0"
                  }
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl border bg-white shadow-sm">
            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Servicios y experiencia
                  </h2>
                  <p className="text-sm text-slate-600">
                    Experiencia, calidad y alcance del profesional.
                  </p>
                </div>
                {showFavorite ? <FavoriteProButton proId={proId} /> : null}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatPill
                  label="Experiencia"
                  value={
                    typeof yearsExperience === "number"
                      ? `${yearsExperience} años`
                      : "—"
                  }
                />
                <StatPill
                  label="Trabajos finalizados"
                  value={
                    typeof jobsDone === "number" ? jobsDone.toString() : "—"
                  }
                />
                <StatPill
                  label="Calificación"
                  value={
                    typeof averageRating === "number"
                      ? averageRating.toFixed(1)
                      : "—"
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                {categoriesLabel && categoriesLabel !== "—" ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    {categoriesLabel}
                  </span>
                ) : null}
                {serviceCities.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-slate-100 px-3 py-1 text-slate-800"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-white shadow-sm">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Trabajos realizados
              </h2>
              <div className="mt-3">
                {jobsWithPhotos.length ? (
                  <CompletedWorks
                    items={jobsWithPhotos.map((j) => ({
                      request_id: j.request_id,
                      title: j.request_title || "Solicitud",
                      photos: j.photos.slice(0, 6).map((u, i) => ({
                        id: `${j.request_id}-${i}`,
                        url: u,
                        alt: `Foto del trabajo: ${
                          j.request_title || "Solicitud"
                        }`,
                      })),
                    }))}
                  />
                ) : (
                  <p className="text-sm text-slate-600">
                    Aún no hay trabajos realizados.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-white shadow-sm">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Certificaciones
              </h2>
              <div className="mt-3">
                {certifications.length ? (
                  <div className="flex flex-wrap gap-2">
                    {certifications.map((c) => (
                      <CertChip key={c}>{c}</CertChip>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Sin certificaciones registradas.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-white shadow-sm">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Galería de trabajos
              </h2>
              <div className="mt-3">
                {portfolio && portfolio.length ? (
                  <PhotoMasonry photos={portfolio} />
                ) : (
                  <p className="text-sm text-slate-600">
                    Aún no hay fotos en el portafolio.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-white shadow-sm">
            <div className="p-5 space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Reseñas</h2>
              <ReviewsListClient
                professionalId={proId}
                initial={reviewsData.items as any}
                nextCursor={reviewsData.nextCursor}
                total={reviewsData.count}
              />
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-base text-slate-900">{value || "—"}</dd>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-slate-50 px-3 py-3 text-center shadow-sm">
      <span className="text-lg font-semibold text-slate-900">{value}</span>
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </div>
  );
}
