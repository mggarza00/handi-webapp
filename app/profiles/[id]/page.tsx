import * as React from "react";
import { headers } from "next/headers";

import Breadcrumbs from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Ctx = { params: { id: string } };

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  return process.env.NEXT_PUBLIC_BASE_URL || (host ? `${proto}://${host}` : "http://localhost:3000");
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="text-amber-500" aria-label={`Calificación ${v} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (i < v ? "★" : "☆")).join("")}
    </span>
  );
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const base = getBaseUrl();
  try {
    const res = await fetch(`${base}/api/profiles/${params.id}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      cache: "no-store",
    });
    const j = await res.json();
    const p = j?.data as { full_name?: string | null; headline?: string | null } | undefined;
    const titleName = p?.full_name?.trim() || "Perfil profesional";
    const desc = p?.headline?.trim() || "Perfil profesional en Handee";

    // OG image: intenta galería, si no, usa logo
    let imageUrl = `${base}/handee-logo.png`;
    try {
      const gRes = await fetch(`${base}/api/profiles/${params.id}/gallery`, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        cache: "no-store",
      });
      const gJson = await gRes.json();
      const first = Array.isArray(gJson?.data) && gJson.data.length > 0 ? gJson.data[0] : null;
      if (first?.url) imageUrl = first.url as string;
    } catch {
      // ignore
    }

    return {
      title: `${titleName} — Handee`,
      description: desc,
      openGraph: {
        title: `${titleName} — Handee`,
        description: desc,
        url: `${base}/profiles/${params.id}`,
        images: [imageUrl],
        siteName: "Handee",
        type: "profile",
      },
      twitter: {
        card: "summary_large_image",
        title: `${titleName} — Handee`,
        description: desc,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: "Perfil — Handee" };
  }
}

export default async function PublicProfilePage({ params }: Ctx) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/profiles/${params.id}`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-store",
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
    last_active_at?: string | null;
  };

  type Named = { name: string } | string;
  const categories = ((p.categories ?? []) as Named[])
    .map((x) => (typeof x === "string" ? x : x?.name))
    .filter((s): s is string => Boolean(s));
  const subcategories = ((p.subcategories ?? []) as Named[])
    .map((x) => (typeof x === "string" ? x : x?.name))
    .filter((s): s is string => Boolean(s));

  // Cargar galería
  const gRes = await fetch(`${base}/api/profiles/${params.id}/gallery`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-store",
  });
  const gJson = await gRes.json().catch(() => null);
  const gallery: Array<{ url: string; path: string; name: string }> = gRes.ok && gJson?.data ? gJson.data : [];

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
          <div className="flex items-center gap-2 mt-1 text-sm">
            {typeof p.rating === "number" && <Stars value={p.rating} />}
            {p.city && <span className="text-slate-600">{p.city}</span>}
            {p.is_featured ? <Badge>Destacado</Badge> : null}
          </div>
        </div>
      </header>

      {p.bio && (
        <Card className="p-4">
          <h2 className="font-medium mb-2">Sobre mí</h2>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{p.bio}</p>
        </Card>
      )}

      {(categories.length > 0 || subcategories.length > 0) && (
        <Card className="p-4">
          <h2 className="font-medium mb-2">Especialidades</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Badge key={c} variant="secondary">{c}</Badge>
            ))}
            {subcategories.map((s) => (
              <Badge key={s} variant="outline">{s}</Badge>
            ))}
          </div>
        </Card>
      )}

      {p.years_experience != null && (
        <Card className="p-4">
          <h2 className="font-medium mb-2">Experiencia</h2>
          <p className="text-sm text-slate-700">{p.years_experience} años de experiencia</p>
        </Card>
      )}

      {gallery.length > 0 && (
        <Card className="p-4">
          <h2 className="font-medium mb-2">Galería</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gallery.map((g) => (
              <a key={g.path} href={g.url} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url} alt={g.name} className="w-full h-40 object-cover rounded border" />
              </a>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
