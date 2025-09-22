import * as React from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

import ChatStartPro from "./chat-start-pro.client";

import { Card } from "@/components/ui/card";
import PhotoGallery from "@/components/ui/PhotoGallery";
import type { Database } from "@/types/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  const supabase = createServerComponentClient<Database>({ cookies });
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
        No se encontró la solicitud.
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
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    for (const raw of atts) {
      const f = raw as Record<string, unknown>;
      let href = (typeof f.url === "string" ? f.url : undefined) as string | undefined;
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
      if (href) photos.push({ url: href, alt: (f.mime as string | undefined) ?? null });
    }
  }

  const title = (d.title as string | null) ?? null;
  const city = (d.city as string | null) ?? null;
  const category = (d.category as string | null) ?? null;
  const description = (d.description as string | null) ?? null;
  const budget = typeof d.budget === "number" ? (d.budget as number) : null;
  const requiredAt = (d.required_at as string | null) ?? null;
  const status = (d.status as string | null) ?? null;
  const createdAt = (d.created_at as string | null) ?? null;
  const createdBy = (d.created_by as string | undefined) ?? null;

  // Cargar perfil básico del cliente
  const supabaseS = createServerComponentClient<Database>({ cookies });
  const { data: clientProfile } = await supabaseS
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", createdBy ?? "")
    .maybeSingle<{
      full_name: string | null;
      avatar_url: string | null;
    }>();

  const initials = (name?: string | null) =>
    (name ?? "Cliente")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => (s?.[0] ? s[0].toUpperCase() : ""))
      .join("") || "CL";

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <nav className="text-sm text-slate-600">
        <Link href="/" className="hover:underline">Inicio</Link> / {" "}
        <Link href="/requests/explore" className="hover:underline">Trabajos disponibles</Link> / {" "}
        <span className="text-slate-900 font-medium">{title ?? "Solicitud"}</span>
      </nav>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <h1 className="text-2xl font-semibold">{title ?? "Solicitud"}</h1>
          <p className="text-sm text-slate-600">
            {city ?? "—"} · {category ?? "—"}
            {subcategory ? ` · ${subcategory}` : ""}
          </p>

          {photos.length > 0 ? (
            <PhotoGallery photos={photos} className="mt-2" />
          ) : null}

          {description ? (
            <div className="prose max-w-none">
              <h2 className="text-lg font-medium">Descripción</h2>
              <p className="whitespace-pre-wrap text-slate-800 text-sm">{description}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-4 text-sm">
              <p className="text-slate-500">Presupuesto</p>
              <p className="font-medium">{budget != null ? `$${budget}` : "No especificado"}</p>
            </Card>
            <Card className="p-4 text-sm">
              <p className="text-slate-500">Fecha requerida</p>
              <p className="font-medium">{requiredAt ?? "Por definir"}</p>
            </Card>
            <Card className="p-4 text-sm">
              <p className="text-slate-500">Estado</p>
              <p className="font-medium">{status ?? "active"}</p>
            </Card>
            <Card className="p-4 text-sm">
              <p className="text-slate-500">Creada</p>
              <p className="font-medium">{createdAt?.slice(0,10) ?? "—"}</p>
            </Card>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-4 space-y-3">
            <h2 className="font-medium">{clientProfile?.full_name ?? "Cliente"}</h2>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {clientProfile?.avatar_url ? (
                  <AvatarImage
                    src={clientProfile.avatar_url}
                    alt={clientProfile.full_name ?? "Cliente"}
                  />
                ) : (
                  <AvatarFallback>{initials(clientProfile?.full_name)}</AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs text-slate-600">
                  Calificación: — {" "}
                  {createdBy ? (
                    <Link href={`/clients/${createdBy}`} className="underline hover:no-underline">
                      ver perfil y reseñas
                    </Link>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="pt-2">
              <ChatStartPro requestId={String(d.id ?? params.id)} />
            </div>
          </Card>
          {/* Se eliminó Postularme; acciones se integran en el chat */}
        </aside>
      </section>

      
    </main>
  );
}
