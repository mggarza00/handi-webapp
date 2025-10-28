import * as React from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import Breadcrumbs from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import PublicProfileHeader from "@/components/profiles/PublicProfileHeader";
import FavoriteProButton from "@/components/profiles/FavoriteProButton.client";
import MetricCard from "@/components/profiles/MetricCard";
import CertChip from "@/components/profiles/CertChip";
import PhotoMasonry from "@/components/profiles/PhotoMasonry";
import ExpandableText from "@/components/profiles/ExpandableText.client";
import ReviewsListClient from "@/components/profiles/ReviewsList.client";

import type { Database } from "@/types/supabase";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getProfessionalOverview, getPortfolio as loadPortfolio, getReviews as loadReviews } from "@/lib/profiles/data";

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
    const name = ((ov.pro as any)?.profiles?.full_name as string) || (ov.pro as any)?.full_name || "Perfil profesional";
    const rawBio = (((ov.pro as any)?.bio as string) || "").toString();
    const firstLine = rawBio.split(/\r?\n/)[0] || "";
    const bioText = firstLine;
    const titleName = `${name} Perfil profesional`;
    const desc = bioText.length > 160 ? `${bioText.slice(0, 157)}…` : bioText || "Perfil profesional en Handi";

    // Prefer avatar as OG if available, else fallback
    let imageUrl = (((ov.pro as any)?.profiles?.avatar_url as string) || (ov.pro as any)?.avatar_url || `${base}/avatar.png`) as string;

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
  if (!pro) return notFound();

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
    const photos = (data ?? []) as Array<Database["public"]["Tables"]["service_photos"]["Row"]>;
    const reqIds = Array.from(new Set(photos.map((p) => p.request_id))).filter(Boolean) as string[];
    let titles = new Map<string, string>();
    if (reqIds.length) {
      const rq = await supa.from("requests").select("id, title").in("id", reqIds);
      const rows = (rq.data ?? []) as Array<Database["public"]["Tables"]["requests"]["Row"]>;
      titles = new Map(rows.map((r) => [r.id, r.title]));
    }
    return photos.map((x) => ({ url: x.image_url, requestId: x.request_id, title: titles.get(x.request_id) || undefined, createdAt: x.uploaded_at || undefined }));
  }

  async function getReviews(id: string, limit = 10): Promise<{ items: ReviewDTO[]; count: number; nextCursor: string | null; average: number | null }> {
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
    const nextCursor = items.length ? `${items[items.length - 1].createdAt}|${items[items.length - 1].id}` : null;
    let average: number | null = null;
    try {
      if (Array.isArray(avg.data) && avg.data.length > 0) {
        const v = (avg.data[0] as any)?.avg;
        average = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(average)) average = null;
      }
    } catch { /* ignore */ }
    return { items, count: count ?? 0, nextCursor, average };
  }

  const [portfolio, reviewsData] = await Promise.all([
    loadPortfolio(supa, proId, 18),
    loadReviews(supa, proId, 10),
  ]);

  // Jobs done (completed agreements)
  const jobsDone = overview.jobsDone;

  // Certifications (best-effort, optional column)
  let certifications: string[] = [];
  try {
    const prow = await supa.from("professionals").select("id, certifications").eq("id", proId).maybeSingle();
    const raw = (prow.data as unknown as { certifications?: unknown } | null)?.certifications;
    const toArray = (v: unknown): unknown[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        const s = v.trim();
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed as unknown[];
        } catch {}
        if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
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

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Profesionales", href: "/professionals" },
          { label: (pro.full_name as string) || "Perfil" },
        ]}
      />

      {/** TODO(schema): verified -> prefer professionals.verified; fallback: professionals_with_profile.is_featured */}
      {/** TODO(schema): categories -> prefer professionals.main_categories; fallback: categories/subcategories */}
      <PublicProfileHeader
        name={((pro as any)?.profiles?.full_name as string) || (pro as any)?.full_name || "Profesional"}
        avatarUrl={((pro as any)?.profiles?.avatar_url as string) || (pro as any)?.avatar_url || undefined}
        city={((pro as any)?.profiles?.city as string) || (pro as any)?.city || undefined}
        verified={((pro as any)?.verified as boolean | null) ?? ((pro as any)?.is_featured as boolean | null) ?? undefined}
        averageRating={typeof reviewsData.average === 'number' ? reviewsData.average : undefined}
        ratingCount={reviewsData.count}
        yearsExperience={typeof (pro as any)?.years_experience === 'number' ? ((pro as any)?.years_experience as number) : undefined}
        jobsDone={typeof jobsDone === 'number' ? jobsDone : undefined}
        categories={(categories.length ? categories : subcategories).join(", ")}
        actions={<FavoriteProButton proId={proId} />}
      />

      {/* Quick metrics */}
      <section aria-label="Métricas rápidas">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard label="Años de experiencia" value={
            typeof (pro as any)?.years_experience === 'number' ? ((pro as any)?.years_experience as number) : '—'
          } />
          <MetricCard label="Trabajos finalizados" value={typeof jobsDone === 'number' ? jobsDone : 0} />
          <MetricCard label="Calificación promedio" value={
            typeof reviewsData.average === 'number' ? reviewsData.average.toFixed(1) : (typeof (pro as any)?.rating === 'number' ? ((pro as any)?.rating as number).toFixed(1) : '—')
          } />
        </div>
      </section>

      {/* About (bio colapsable, máx 35 párrafos) */}
      {pro.bio ? (
        <Card className="p-4">
          <h2 className="mb-2 font-medium">Sobre mí</h2>
          <ExpandableText text={(pro.bio as string) || ""} maxParagraphs={35} previewParagraphs={4} />
        </Card>
      ) : null}

      {/* Certificaciones */}
      <Card className="p-4">
        <h2 className="mb-2 font-medium">Certificaciones</h2>
        {certifications.length ? (
          <div className="flex flex-wrap gap-2">
            {certifications.map((c) => (
              <CertChip key={c}>{c}</CertChip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Sin certificaciones registradas.</p>
        )}
      </Card>

      {/* Portfolio */}
      {portfolio && portfolio.length ? (
        <Card className="p-4">
          <h2 className="mb-2 font-medium">Trabajos realizados</h2>
          <PhotoMasonry photos={portfolio} />
        </Card>
      ) : (
        <Card className="p-4 text-sm text-slate-600">Aún no hay fotos en el portafolio.</Card>
      )}

      {/* Reviews */}
      <section aria-label="Reseñas de clientes" className="space-y-3">
        <h2 className="text-base font-medium">Reseñas</h2>
        <ReviewsListClient professionalId={proId} initial={reviewsData.items as any} nextCursor={reviewsData.nextCursor} total={reviewsData.count} />
      </section>
    </main>
  );
}
