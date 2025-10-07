import * as React from "react";
import { headers } from "next/headers";

import AdminProDecision from "@/components/admin/AdminProDecision.client";
import Breadcrumbs from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import StarRating from "@/components/StarRating";

import ReviewsCarousel from "./_components/ReviewsCarousel";
import JobHistoryGrid from "./_components/JobHistoryGrid";

type Ctx = { params: { id: string } };

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
    const res = await fetch(`${base}/api/profiles/${params.id}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      next: { revalidate: 0 },
    });
    const j = await res.json();
    const p = j?.data as { full_name?: string | null; headline?: string | null } | undefined;
    const titleName = p?.full_name?.trim() || "Perfil profesional";
    const desc = p?.headline?.trim() || "Perfil profesional en Homaid";

    let imageUrl = `${base}/homaid-logo.gif`;
    try {
      const gRes = await fetch(`${base}/api/professionals/${params.id}/gallery`, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        next: { revalidate: 0 },
      });
      const gJson = await gRes.json();
      const first = Array.isArray(gJson?.data) && gJson.data.length > 0 ? gJson.data[0] : null;
      if (first?.url) imageUrl = first.url as string;
    } catch {}

    return {
      title: `${titleName} · Homaid`,
      description: desc,
      openGraph: {
        title: `${titleName} · Homaid`,
        description: desc,
        url: `${base}/profiles/${params.id}`,
        images: [imageUrl],
        siteName: "Homaid",
        type: "profile",
      },
      twitter: {
        card: "summary_large_image",
        title: `${titleName} · Homaid`,
        description: desc,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: "Perfil · Homaid" };
  }
}

export default async function PublicProfilePage({ params }: Ctx) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/profiles/${params.id}`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    next: { tags: [`profile:${params.id}`] },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="mt-4 text-sm text-red-600">No se pudo cargar el perfil solicitado.</p>
      </main>
    );
  }

  const p = json.data as {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    headline: string | null;
    bio: string | null;
    rating: number | null;
    years_experience: number | null;
    city: string | null;
    categories?: Array<{ name: string } | string> | null;
    subcategories?: Array<{ name: string } | string> | null;
    is_featured?: boolean | null;
  };

  type Named = { name: string } | string;
  const categories = ((p.categories ?? []) as Named[])
    .map((x) => (typeof x === "string" ? x : x?.name))
    .filter((s): s is string => Boolean(s));
  const subcategories = ((p.subcategories ?? []) as Named[])
    .map((x) => (typeof x === "string" ? x : x?.name))
    .filter((s): s is string => Boolean(s));

  const gRes = await fetch(`${base}/api/professionals/${params.id}/gallery`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    next: { tags: [`profile:${params.id}`] },
  });
  const gJson = await gRes.json().catch(() => null);
  const gallery: Array<{ url: string; path: string; name: string }> = gRes.ok && gJson?.data ? gJson.data : [];

  const sRes = await fetch(
    `${base}/api/reviews?professional_id=${encodeURIComponent(params.id)}&aggregate=1`,
    { headers: { "Content-Type": "application/json; charset=utf-8" }, next: { tags: [`profile:${params.id}`] } },
  );
  const sJson = await sRes.json().catch(() => null);
  const summary: { count: number; average: number | null } | null = sRes.ok && sJson?.summary ? sJson.summary : null;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Perfiles", href: "/professionals" },
          { label: p.full_name ?? "Perfil" },
        ]}
      />
      <header className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.avatar_url || "/avatar.png"}
          alt={p.full_name || "Avatar"}
          className="size-16 rounded-full border object-cover"
        />
        <div>
          <h1 className="text-2xl font-semibold">{p.full_name ?? "Profesional"}</h1>
          <p className="text-sm text-slate-600">{p.headline ?? ""}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            {typeof p.rating === "number" && <StarRating value={p.rating} />}
            {p.city && <span className="text-slate-600">{p.city}</span>}
            {p.is_featured ? <Badge>Destacado</Badge> : null}
            <span className="text-slate-700">
              {summary && summary.count > 0 ? `${(summary.average ?? 0).toFixed(1)} (${summary.count})` : "Sin reseñas aún"}
            </span>
          </div>
        </div>
      </header>

      {/* Controles admin: aceptar/rechazar solicitud pro (si aplica) */}
      <AdminProDecision userId={p.id} />

      {p.bio && (
        <Card className="p-4">
          <h2 className="mb-2 font-medium">Sobre mí</h2>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{p.bio}</p>
        </Card>
      )}

      {(categories.length > 0 || subcategories.length > 0) && (
        <Card className="p-4">
          <h2 className="mb-2 font-medium">Especialidades</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Badge key={c} variant="secondary">
                {c}
              </Badge>
            ))}
            {subcategories.map((s) => (
              <Badge key={s} variant="outline">
                {s}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <h2 className="font-medium">Experiencia</h2>
        {p.years_experience != null ? (
          <p className="text-sm text-slate-700">{p.years_experience} años de experiencia</p>
        ) : null}
        <section aria-label="Reseñas de clientes" className="space-y-3">
          <ReviewsCarousel professionalId={params.id} />
        </section>
        <section aria-label="Trabajos realizados" className="space-y-3">
          <JobHistoryGrid professionalId={params.id} />
        </section>
      </Card>

      {gallery.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 font-medium">Galería</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {gallery.map((g) => (
              <a key={g.path} href={g.url} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url} alt={g.name} className="h-40 w-full rounded border object-cover" />
              </a>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}