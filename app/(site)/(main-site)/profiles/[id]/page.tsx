import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import localFont from "next/font/local";

import type { Database } from "@/types/supabase";
import Breadcrumbs from "@/components/breadcrumbs";
import FavoriteProButton from "@/components/profiles/FavoriteProButton.client";
import ProfileHeaderCard from "@/components/profiles/ProfileHeaderCard";
import CertChip from "@/components/profiles/CertChip";
import CompletedWorks from "@/components/profiles/CompletedWorks";
import ExpandableText from "@/components/profiles/ExpandableText.client";
import PhotoMasonry from "@/components/profiles/PhotoMasonry";
import ReviewsListClient from "@/components/profiles/ReviewsList.client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getProfessionalOverview,
  getPortfolio as loadPortfolio,
  getReviews as loadReviews,
} from "@/lib/profiles/data";
import { getProJobsWithPhotos } from "@/lib/profiles/jobs";
import { getAdminSupabase } from "@/lib/supabase/admin";
import createClient from "@/utils/supabase/server";

import "./profile-layout.css";

const stackSansHeading = localFont({
  src: "../../../../../public/fonts/Stack_Sans_Text/static/StackSansText-SemiBold.ttf",
  weight: "600",
  display: "swap",
});

type Ctx = { params: { id: string } };

const getString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const getBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

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
    const proData = ov.pro;
    const profileData = proData?.profiles ?? null;
    const name =
      getString(profileData?.full_name) ||
      getString(proData?.full_name) ||
      "Perfil profesional";
    const rawBio = (getString(proData?.bio) || "").toString();
    const firstLine = rawBio.split(/\r?\n/)[0] || "";
    const bioText = firstLine;
    const titleName = `${name} Perfil profesional`;
    const desc =
      bioText.length > 160
        ? `${bioText.slice(0, 157)}…`
        : bioText || "Perfil profesional en Handi";

    // Prefer avatar as OG if available, else fallback
    const imageUrl =
      getString(profileData?.avatar_url) ||
      getString(proData?.avatar_url) ||
      `${base}/avatar.png`;

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

  const categories = overview.categories;
  const subcategories = overview.subcategories;

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
  const isOwner = auth?.user?.id === proId;
  if (auth?.user) {
    const uid = auth.user.id;
    if (uid !== proId) {
      const { data: viewerProfile } = await rls
        .from("profiles")
        .select("id, role")
        .eq("id", uid)
        .maybeSingle<{ id: string; role: "client" | "pro" | "admin" | null }>();
      const vrole = viewerProfile?.role ?? null;
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
    const raw = (prow.data as { certifications?: unknown } | null)
      ?.certifications;
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
        if (s.includes(","))
          return s
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
        return s ? [s] : [];
      }
      return [];
    };
    const toName = (value: unknown): string | null => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object" && "name" in value) {
        const nameValue = (value as { name?: unknown }).name;
        return typeof nameValue === "string" ? nameValue : null;
      }
      return null;
    };
    certifications = toArray(raw)
      .map((x) => toName(x))
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .map((s) => s.trim());
  } catch {
    /* ignore */
  }

  const proData = pro;
  const profileData = proData.profiles ?? null;
  const displayName =
    getString(profileData?.full_name) ||
    getString(proData?.full_name) ||
    "Profesional";
  const avatarUrl =
    getString(profileData?.avatar_url) ||
    getString(proData?.avatar_url) ||
    "/avatar.png";
  const cityLabel =
    getString(profileData?.city) || getString(proData?.city) || null;
  const categoriesLabel =
    (categories.length ? categories : subcategories).join(", ") || "—";
  const subcategoriesLabel = subcategories.join(", ") || "—";
  const serviceCities = overview.cities ?? [];
  const yearsExperience = getNumber(proData.years_experience) ?? null;
  const averageRating =
    typeof reviewsData.average === "number"
      ? reviewsData.average
      : (getNumber(proData.rating) ?? null);
  const bio = getString(proData.bio);
  const isVerified = Boolean(
    getBoolean(proData.verified) || getBoolean(proData.is_featured),
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Profesionales", href: "/professionals" },
          { label: displayName || "Perfil" },
        ]}
      />

      <ProfileHeaderCard
        displayName={displayName}
        avatarUrl={avatarUrl}
        cityLabel={cityLabel}
        yearsExperience={yearsExperience}
        jobsDone={jobsDone}
        categoriesLabel={categoriesLabel}
        serviceCities={serviceCities}
        averageRating={averageRating}
        reviewsCount={reviewsData.count}
        headingClassName={stackSansHeading.className}
        isVerified={isVerified}
        rightAction={
          isOwner ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/profile/setup">Editar</Link>
            </Button>
          ) : showFavorite ? (
            <FavoriteProButton proId={proId} />
          ) : null
        }
      />

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
                {bio ? (
                  <ExpandableText
                    text={bio}
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
                initial={reviewsData.items}
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
