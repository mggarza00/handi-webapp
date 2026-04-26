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
import ExpandableChipList from "@/components/profiles/ExpandableChipList.client";
import HireProfessionalButton from "@/components/profiles/HireProfessionalButton.client";
import PortfolioByRequest from "@/components/profiles/PortfolioByRequest.client";
import ProfileHeaderCard from "@/components/profiles/ProfileHeaderCard";
import ShareProfileButton from "@/components/profiles/ShareProfileButton.client";
import ServiceTagOverflow from "@/components/profiles/ServiceTagOverflow.client";
import CertChip from "@/components/profiles/CertChip";
import ReviewsListClient from "@/components/profiles/ReviewsList.client";
import ProActivityRefresher from "@/components/realtime/ProActivityRefresher.client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type ColoredTag,
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

type WorkGalleryItem = {
  requestId: string;
  title: string;
  photos: string[];
  sortDate: string | null;
};

const pickMostRecentDate = (
  current: string | null,
  candidate: string | null | undefined,
): string | null => {
  const next =
    typeof candidate === "string" && candidate.trim().length ? candidate : null;
  if (!next) return current;
  if (!current) return next;
  return current < next ? next : current;
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

  const [reviewsData, jobsWithPhotos, portfolio] = await Promise.all([
    loadReviews(supa, proId, 5),
    getProJobsWithPhotos(supa, proId, 12),
    loadPortfolio(supa, proId, 24),
  ]);

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
    const toArray = (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed as unknown[];
        } catch {
          // ignore
        }
        if (trimmed.includes(",")) {
          return trimmed
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        }
        return trimmed ? [trimmed] : [];
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
      .map((item) => toName(item))
      .filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
      .map((item) => item.trim());
  } catch {
    // ignore
  }

  const proData = pro;
  const profileData = getProfileRecord(proData.profiles);
  const proUserId = getString(proData.user_id) || null;
  const rls = createClient();
  const { data: auth } = await rls.auth.getUser();
  const viewerId = auth?.user?.id ?? null;
  const isOwner = Boolean(
    viewerId && (viewerId === proId || (proUserId && viewerId === proUserId)),
  );

  let viewerRole: "client" | "pro" | "admin" | null = null;
  let viewerIsClientPro = false;
  let showFavorite = false;
  if (viewerId && !isOwner) {
    const { data: viewerProfile } = await rls
      .from("profiles")
      .select("id, role, is_client_pro")
      .eq("id", viewerId)
      .maybeSingle<{
        id: string;
        role: "client" | "pro" | "admin" | null;
        is_client_pro: boolean | null;
      }>();
    viewerRole = viewerProfile?.role ?? null;
    viewerIsClientPro = viewerProfile?.is_client_pro === true;
    showFavorite = viewerRole === "client" || viewerIsClientPro;
  }

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
    typeof overview.averageRating === "number" &&
    Number.isFinite(overview.averageRating)
      ? overview.averageRating
      : typeof reviewsData.average === "number" &&
          Number.isFinite(reviewsData.average)
        ? reviewsData.average
        : null;
  const reviewsCount = Math.max(
    typeof overview.ratingCount === "number" ? overview.ratingCount : 0,
    typeof reviewsData.count === "number" ? reviewsData.count : 0,
  );
  const canHireAsClient = Boolean(
    viewerId && !isOwner && (viewerRole === "client" || viewerIsClientPro),
  );
  const bio = getString(proData.bio);
  const isVerified = Boolean(
    getBoolean(proData.verified) || getBoolean(proData.is_featured),
  );
  const categoryTags = overview.coloredTags.filter(
    (tag) => tag.type === "category",
  );
  const primaryCategoryTag = categoryTags[0] ?? null;
  const subcategoryTags = overview.subcategories.map((name) => {
    const matchingTag = overview.coloredTags.find(
      (tag) =>
        tag.type === "subcategory" &&
        tag.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (matchingTag) {
      return {
        ...matchingTag,
        bgColor: matchingTag.bgColor ?? primaryCategoryTag?.bgColor ?? null,
        textColor:
          matchingTag.textColor ?? primaryCategoryTag?.textColor ?? null,
        borderColor:
          matchingTag.borderColor ?? primaryCategoryTag?.borderColor ?? null,
      } satisfies ColoredTag;
    }
    return {
      name,
      type: "subcategory" as const,
      bgColor: primaryCategoryTag?.bgColor ?? null,
      textColor: primaryCategoryTag?.textColor ?? null,
      borderColor: primaryCategoryTag?.borderColor ?? null,
    } satisfies ColoredTag;
  });
  const worksByRequest = new Map<string, WorkGalleryItem>();
  for (const job of jobsWithPhotos) {
    worksByRequest.set(job.request_id, {
      requestId: job.request_id,
      title: job.request_title || "Solicitud",
      photos: Array.from(new Set(job.photos.filter(Boolean))).slice(0, 6),
      sortDate: job.completed_at ?? null,
    });
  }
  for (const item of portfolio) {
    const requestId =
      typeof item.requestId === "string" && item.requestId.trim().length
        ? item.requestId.trim()
        : `portfolio:${item.title || item.url}`;
    const existing = worksByRequest.get(requestId);
    if (!existing) {
      worksByRequest.set(requestId, {
        requestId,
        title: item.title?.trim() || "Solicitud",
        photos: item.url ? [item.url] : [],
        sortDate: item.createdAt ?? null,
      });
      continue;
    }
    if (
      item.url &&
      !existing.photos.includes(item.url) &&
      existing.photos.length < 6
    ) {
      existing.photos.push(item.url);
    }
    if (
      (!existing.title || existing.title === "Solicitud") &&
      item.title?.trim()
    ) {
      existing.title = item.title.trim();
    }
    existing.sortDate = pickMostRecentDate(existing.sortDate, item.createdAt);
    worksByRequest.set(requestId, existing);
  }
  const workGalleryItems = Array.from(worksByRequest.values())
    .sort((a, b) => {
      const av = a.sortDate || "";
      const bv = b.sortDate || "";
      return av < bv ? 1 : av > bv ? -1 : 0;
    })
    .slice(0, 12);
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
  if (normalizedAvatarUrl) {
    professionalServiceJsonLd.image = normalizedAvatarUrl;
  }
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
    reviewsCount > 0
  ) {
    professionalServiceJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(averageRating.toFixed(1)),
      reviewCount: reviewsCount,
    };
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-28 md:px-6 md:pb-8">
      <ProActivityRefresher proId={proId} />
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
        reviewsCount={reviewsCount}
        headingClassName={stackSansHeading.className}
        isVerified={isVerified}
        primaryAction={
          isOwner ? (
            <Button
              asChild
              className="h-11 rounded-full bg-[#082877] hover:bg-[#061c53]"
            >
              <Link href="/profile/setup">Editar perfil</Link>
            </Button>
          ) : (
            <HireProfessionalButton
              professionalId={proId}
              professionalName={displayName}
              cities={serviceCities}
              categories={overview.categories}
              subcategories={overview.subcategories}
              categoryTags={categoryTags}
              subcategoryTags={subcategoryTags}
              isAuthenticated={Boolean(viewerId)}
              canHireAsClient={canHireAsClient}
              stickyMobile
              className="w-full"
              buttonClassName="w-full"
            />
          )
        }
        secondaryAction={
          <ShareProfileButton
            title={`${displayName} | Perfil profesional en Handi`}
            className="w-full"
          />
        }
        tertiaryAction={
          !isOwner && showFavorite ? (
            <FavoriteProButton proId={proId} className="w-full" />
          ) : null
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
        <div className="space-y-6">
          <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Servicios y cobertura
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Categorías, subcategorías y zonas donde este profesional
                  ofrece sus servicios.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Categorías
                  </p>
                  <div className="mt-3">
                    {categoryTags.length ? (
                      <ServiceTagOverflow
                        tags={categoryTags}
                        maxVisible={4}
                        overflowLabel="Ver todas"
                      />
                    ) : (
                      <CompactEmptyState text="Sin categorías registradas" />
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Subcategorías
                  </p>
                  <div className="mt-3">
                    {subcategoryTags.length ? (
                      <ServiceTagOverflow
                        tags={subcategoryTags}
                        maxVisible={4}
                        overflowLabel="Ver todas"
                      />
                    ) : (
                      <CompactEmptyState text="Sin subcategorías registradas" />
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Ciudades de atención
                  </p>
                  <div className="mt-3">
                    <ExpandableChipList
                      items={serviceCities}
                      maxVisible={5}
                      singleLine
                      emptyText="Este profesional aún no ha definido sus zonas de atención."
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Certificaciones
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Documentos o credenciales visibles para los clientes.
                </p>
              </div>
              {certifications.length ? (
                <div className="flex flex-wrap gap-2">
                  {certifications.map((certification) => (
                    <CertChip key={certification}>{certification}</CertChip>
                  ))}
                </div>
              ) : (
                <CompactEmptyState text="Sin certificaciones registradas por el momento." />
              )}
            </div>
          </Card>

          {!isOwner ? (
            <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
              <div className="space-y-3 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-slate-950">
                  Explora servicios relacionados
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <Link
                    href="/servicios/plomero/monterrey"
                    className="text-sm font-medium text-[#082877] hover:underline"
                  >
                    Plomero en Monterrey
                  </Link>
                  <Link
                    href="/servicios/plomero/san-pedro-garza-garcia"
                    className="text-sm font-medium text-[#082877] hover:underline"
                  >
                    Plomero en San Pedro
                  </Link>
                  <Link
                    href="/servicios/electricista/monterrey"
                    className="text-sm font-medium text-[#082877] hover:underline"
                  >
                    Electricista en Monterrey
                  </Link>
                  <Link
                    href="/servicios/limpieza/monterrey"
                    className="text-sm font-medium text-[#082877] hover:underline"
                  >
                    Limpieza en Monterrey
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </section>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Trabajos realizados
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Solicitudes agrupadas con fotos reales compartidas por el
              profesional.
            </p>
          </div>
          {workGalleryItems.length ? (
            <PortfolioByRequest
              items={workGalleryItems.map((job) => ({
                requestId: job.requestId,
                title: job.title || "Solicitud",
                photos: job.photos.slice(0, 6),
              }))}
            />
          ) : (
            <CompactEmptyState text="Todavía no hay trabajos realizados publicados en este perfil." />
          )}
        </div>
      </Card>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Reseñas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Opiniones de clientes que ya contrataron a este profesional.
            </p>
          </div>
          {reviewsData.items.length || reviewsCount > 0 ? (
            <ReviewsListClient
              professionalId={proId}
              initial={reviewsData.items}
              nextCursor={reviewsData.nextCursor}
              total={reviewsCount}
            />
          ) : (
            <CompactEmptyState text="Todavía no hay reseñas publicadas en este perfil." />
          )}
        </div>
      </Card>
    </main>
  );
}

function CompactEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-500">
      {text}
    </div>
  );
}
