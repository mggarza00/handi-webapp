import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import localFont from "next/font/local";

import type { Database } from "@/types/supabase";
import ProfessionalProfileViewTracker from "@/components/analytics/ProfessionalProfileViewTracker.client";
import Breadcrumbs from "@/components/breadcrumbs";
import FavoriteProButton from "@/components/profiles/FavoriteProButton.client";
import ProfileHeaderCard from "@/components/profiles/ProfileHeaderCard";
import ServiceTagOverflow from "@/components/profiles/ServiceTagOverflow.client";
import CertChip from "@/components/profiles/CertChip";
import CompletedWorks from "@/components/profiles/CompletedWorks";
import PhotoMasonry from "@/components/profiles/PhotoMasonry";
import ReviewsListClient from "@/components/profiles/ReviewsList.client";
import CampaignCtaGroup from "@/components/seo/CampaignCtaGroup.client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getProfessionalOverview,
  getPortfolio as loadPortfolio,
  getReviews as loadReviews,
} from "@/lib/profiles/data";
import { getProJobsWithPhotos } from "@/lib/profiles/jobs";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { normalizeAvatarUrl } from "@/lib/avatar";
import createClient from "@/utils/supabase/server";

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
const getNamePart = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};
const getComposedName = (
  value: Record<string, unknown> | null | undefined,
): string | null => {
  if (!value) return null;
  const first = getNamePart(value.first_name);
  const last = getNamePart(value.last_name);
  if (first && last) return `${first} ${last}`;
  return first || last || null;
};
const getPreferredName = (
  proData: Record<string, unknown> | null | undefined,
  profileData: Record<string, unknown> | null | undefined,
): string | null => {
  const candidates: Array<string | null> = [
    getNamePart(profileData?.full_name),
    getNamePart(proData?.full_name),
    getNamePart(profileData?.display_name),
    getNamePart(proData?.display_name),
    getNamePart(profileData?.name),
    getNamePart(proData?.name),
    getComposedName(profileData),
    getComposedName(proData),
  ];
  return candidates.find((value): value is string => Boolean(value)) ?? null;
};
const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const getProfileRecord = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) return toRecord(value[0]);
  return toRecord(value);
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

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const base = getBaseUrl();
  try {
    const supa = getAdminSupabase() as SupabaseClient<Database>;
    const ov = await getProfessionalOverview(supa, params.id);
    const proData = ov.pro;
    const profileData = getProfileRecord(proData?.profiles);
    const name = getPreferredName(proData, profileData) || "Perfil profesional";
    const rawBio = (getString(proData?.bio) || "").toString();
    const firstLine = rawBio.split(/\r?\n/)[0] || "";
    const bioText = firstLine;
    const titleName = `${name} Perfil profesional`;
    const desc =
      bioText.length > 160
        ? `${bioText.slice(0, 157)}...`
        : bioText || "Perfil profesional en Handi";

    const imageUrl = normalizeAvatarUrl(
      getString(profileData?.avatar_url) ||
        getString(proData?.avatar_url) ||
        `${base}/avatar.png`,
    );
    const canonical = `/profiles/${params.id}`;

    return {
      title: `${titleName} | Handi`,
      description: desc,
      alternates: { canonical },
      openGraph: {
        title: `${titleName} | Handi`,
        description: desc,
        url: canonical,
        images: imageUrl ? [imageUrl] : undefined,
        siteName: "Handi",
        type: "profile",
      },
      twitter: {
        card: "summary_large_image",
        title: `${titleName} | Handi`,
        description: desc,
        images: imageUrl ? [imageUrl] : undefined,
      },
    };
  } catch {
    return {
      title: "Perfil | Handi",
      alternates: { canonical: `/profiles/${params.id}` },
    };
  }
}
export default async function PublicProfilePage({ params }: Ctx) {
  const supa = getAdminSupabase() as SupabaseClient<Database>;
  const proId = params.id;

  const overview = await getProfessionalOverview(supa, proId);
  const pro = overview.pro;
  if (!pro) {
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

  const coloredTags = overview.coloredTags;

  const [portfolio, reviewsData] = await Promise.all([
    loadPortfolio(supa, proId, 18),
    loadReviews(supa, proId, 5),
  ]);

  const jobsWithPhotos = await getProJobsWithPhotos(supa, proId, 6);

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

  const jobsDone = overview.jobsDone;

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
  const profileData = getProfileRecord(proData.profiles);
  let resolvedDisplayName = getPreferredName(proData, profileData);
  if (!resolvedDisplayName) {
    const fallbackProfile = await supa
      .from("profiles")
      .select("full_name")
      .eq("id", proId)
      .maybeSingle<{ full_name: string | null }>();
    resolvedDisplayName = getNamePart(fallbackProfile.data?.full_name);
  }
  const displayName = resolvedDisplayName || "Profesional";
  const avatarUrl =
    getString(profileData?.avatar_url) ||
    getString(proData?.avatar_url) ||
    "/avatar.png";
  const normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl);
  const cityLabel =
    getString(profileData?.city) || getString(proData?.city) || null;
  const serviceCities = overview.cities ?? [];
  const yearsExperience = getNumber(proData.years_experience) ?? null;
  const averageRating =
    typeof reviewsData.average === "number" &&
    Number.isFinite(reviewsData.average)
      ? reviewsData.average
      : null;
  const bio = getString(proData.bio);
  const isVerified = Boolean(
    getBoolean(proData.verified) || getBoolean(proData.is_featured),
  );
  const baseUrl = getBaseUrl();
  const canonicalProfileUrl = `${baseUrl}/profiles/${proId}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: `${baseUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Profesionales",
        item: `${baseUrl}/professionals`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: displayName,
        item: canonicalProfileUrl,
      },
    ],
  };
  const personJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    url: canonicalProfileUrl,
  };
  if (normalizedAvatarUrl) personJsonLd.image = normalizedAvatarUrl;
  if (bio && bio.trim()) personJsonLd.description = bio.trim();
  if (cityLabel) {
    personJsonLd.homeLocation = {
      "@type": "City",
      name: cityLabel,
    };
  }

  const professionalServiceJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: `${displayName} | Servicios en Handi`,
    url: canonicalProfileUrl,
    provider: {
      "@type": "Person",
      name: displayName,
    },
  };
  if (bio && bio.trim()) professionalServiceJsonLd.description = bio.trim();
  if (normalizedAvatarUrl)
    professionalServiceJsonLd.image = normalizedAvatarUrl;
  if (serviceCities.length > 0) {
    professionalServiceJsonLd.areaServed = serviceCities.map((city) => ({
      "@type": "City",
      name: city,
    }));
  } else if (cityLabel) {
    professionalServiceJsonLd.areaServed = {
      "@type": "City",
      name: cityLabel,
    };
  }
  if (
    typeof averageRating === "number" &&
    Number.isFinite(averageRating) &&
    typeof reviewsData.count === "number" &&
    reviewsData.count > 0
  ) {
    professionalServiceJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(averageRating.toFixed(1)),
      reviewCount: reviewsData.count,
    };
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <ProfessionalProfileViewTracker profileId={proId} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(professionalServiceJsonLd),
        }}
      />
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
        serviceCities={serviceCities}
        bio={bio}
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
      {!isOwner ? (
        <Card className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Listo para avanzar con tu servicio?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Publica tu solicitud para recibir propuestas y comparar opciones con
            contexto de precio, disponibilidad y experiencia.
          </p>
          <div className="mt-4">
            <CampaignCtaGroup
              trackingContext={{
                pageType: "professional_profile",
                placement: "post_header",
                profileId: proId,
              }}
              primary={{ label: "Solicitar servicio", href: "/requests/new" }}
              secondary={{
                label: "Ver mas profesionales",
                href: "/professionals",
              }}
            />
          </div>
        </Card>
      ) : null}

      <section className="space-y-4">
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
                    ? `${yearsExperience} a\u00f1os`
                    : "-"
                }
              />
              <StatPill
                label="Trabajos finalizados"
                value={typeof jobsDone === "number" ? jobsDone.toString() : "-"}
              />
              <StatPill
                label="Calificacion"
                value={
                  typeof averageRating === "number"
                    ? averageRating.toFixed(1)
                    : "-"
                }
              />
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              {coloredTags.length ? (
                <ServiceTagOverflow tags={coloredTags} maxVisible={7} />
              ) : null}
              {serviceCities.length ? (
                <div className="flex flex-wrap gap-2">
                  {serviceCities.map((city) => (
                    <span
                      key={`city-${city}`}
                      className="rounded-full bg-slate-100 px-3 py-1 text-slate-800"
                    >
                      {city}
                    </span>
                  ))}
                </div>
              ) : null}
              {!coloredTags.length && !serviceCities.length ? (
                <p className="text-sm text-muted-foreground">
                  Este profesional aun no ha agregado categorias ni ciudades de
                  servicio.
                </p>
              ) : null}
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
                      alt: `Foto del trabajo: ${j.request_title || "Solicitud"}`,
                    })),
                  }))}
                />
              ) : (
                <p className="text-sm text-slate-600">
                  Aun no hay trabajos realizados.
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
              Galeria de trabajos
            </h2>
            <div className="mt-3">
              {portfolio && portfolio.length ? (
                <PhotoMasonry photos={portfolio} />
              ) : (
                <p className="text-sm text-slate-600">
                  Aun no hay fotos en el portafolio.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border bg-white shadow-sm">
          <div className="p-5 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Resenas</h2>
            <ReviewsListClient
              professionalId={proId}
              initial={reviewsData.items}
              nextCursor={reviewsData.nextCursor}
              total={reviewsData.count}
            />
          </div>
        </Card>
      </section>
    </main>
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
