import * as React from "react";
import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
// import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import RequestDetailClient from "./RequestDetailClient";
import RequestHeaderActions from "./RequestHeaderActions.client";
import AgreementsClient from "./Agreements.client";
// Optionally render applications/offers flow if present in snapshot
// import ApplicationsClient from "./Applications.client";

import Breadcrumbs from "@/components/breadcrumbs";
import { Card } from "@/components/ui/card";
import MobileProsAnchorButton from "./MobileProsAnchorButton.client";
// Removed pre-card PhotoGallery to avoid duplicate images
import ProfessionalsList from "@/components/professionals/ProfessionalsList";
import type { Database } from "@/types/supabase";
import { mapConditionToLabel } from "@/lib/conditions";

type Params = {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
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

export default async function RequestDetailPage({ params }: Params) {
  const base = getBaseUrl();
  const disablePros = (process.env.NEXT_PUBLIC_DISABLE_PROS || "").trim() === "1";
  const disableDetail = (process.env.NEXT_PUBLIC_DISABLE_DETAIL || "").trim() === "1";

  // Forward cookies for SSR fetch
  // Forward raw cookie values to internal API (do NOT URL-encode).
  // Encoding breaks auth tokens (e.g., Supabase JWTs) and can lead to
  // "Auth session missing" on subsequent requests.
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
      <main className="mx-auto max-w-6xl p-6">
        No se encontró la solicitud.
      </main>
    );
  }

  const d = j.data as Record<string, unknown>;

  // Owner-only guard: only the creator can view this client detail page
  try {
    const supabase = createServerComponentClient<Database>({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ownerId = (d.created_by as string | undefined) ?? null;
    if (!user || !ownerId || user.id !== ownerId) {
      redirect(`/requests/explore/${params.id}`);
    }
  } catch {
    redirect(`/requests/explore/${params.id}`);
  }

  // Map subcategory with fallback: prefer JSON array (subcategories), otherwise legacy string field (subcategory)
  let subcategory = "";
  const subs = d.subcategories as unknown;
  if (Array.isArray(subs) && subs.length > 0) {
    const first = subs[0] as unknown;
    subcategory =
      typeof first === "string"
        ? first
        : ((first as { name?: string }).name ?? "");
  } else if (typeof d.subcategory === "string" && d.subcategory.trim()) {
    subcategory = d.subcategory.trim();
  }

  // Build gallery photos from attachments with signed URLs if needed
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
          const admin = createClient(url, serviceRole);
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

  // Important: spread the original row first, then override with normalized fields
  const initial = {
    // Debug panel and any extra fields preserved
    ...d,
    id: String(d.id ?? params.id),
    title: (d.title as string | null) ?? null,
    description: (d.description as string | null) ?? null,
    status: (d.status as string | null) ?? null,
    city: (d.city as string | null) ?? null,
    category: (d.category as string | null) ?? null,
    subcategory,
    budget: typeof d.budget === "number" ? (d.budget as number) : null,
    required_at: (d.required_at as string | null) ?? null,
    conditions: (d.conditions as string | undefined) ?? "",
    photos,
  };

  const conditionsList: string[] = ((initial.conditions as string) || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 10);

  const category = (initial.category ?? "").toString() || undefined;
  const subcat = (initial.subcategory ?? "").toString() || undefined;
  const city = (initial.city ?? "").toString() || undefined;
  // budgetFmt no se usa; si se requiere mostrar, usar Intl a demanda.

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-6 items-start">
        <section className="space-y-4">
          <Breadcrumbs
            items={[
              { label: "Inicio", href: "/" },
              { label: "Solicitudes", href: "/requests?mine=1" },
              { label: initial.title ?? "Solicitud" },
            ]}
          />
          {/* Page header: title + actions */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold text-slate-900">
              {initial.title ?? "Solicitud"}
            </h1>
            <RequestHeaderActions requestId={initial.id} />
          </div>
          {/* Condiciones chips debajo del título (desktop) */}
          {conditionsList.length > 0 ? (
            <div className="hidden md:flex flex-wrap gap-2 mt-2">
              {conditionsList.map((c, i) => (
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

          {/* Mobile-only anchor button to jump to available professionals list */}
          {!disablePros ? (
            <MobileProsAnchorButton category={category} subcategory={subcat} />
          ) : null}
          {/* Condiciones chips debajo del botón (móvil) con espacio */}
          {conditionsList.length > 0 ? (
            <div className="md:hidden flex flex-wrap gap-2 mt-8">
              {conditionsList.map((c, i) => (
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

          {/* Photo gallery removed here; it is rendered after the detail card within RequestDetailClient */}

          {!disableDetail ? (
            <RequestDetailClient initial={initial} hideHeader compactActions />
          ) : (
            <div className="rounded border bg-white p-4 text-sm text-slate-600">
              Detalle desactivado por NEXT_PUBLIC_DISABLE_DETAIL=1
            </div>
          )}

          {/* Agreements flow (offers, status updates, payment actions) */}
          <div className="mt-6">
            <AgreementsClient requestId={initial.id} createdBy={(d.created_by as string | undefined) ?? null} />
          </div>
        </section>

        <aside className="order-last md:order-none md:sticky md:top-4 space-y-4">
          {!disablePros ? (
            <Card id="available-professionals" className="p-4 scroll-mt-24">
              <h2 className="font-medium mb-2">Profesionales disponibles</h2>
              <ProfessionalsList
                requestId={initial.id}
                category={category}
                subcategory={subcat}
                city={city}
              />
            </Card>
          ) : null}</aside>
      </div>

      {/* Trust badges removed per request */}
      
    </main>
  );
}

export const metadata: Metadata = { title: "Solicitud | Handi" };
