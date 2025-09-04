/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import PostulateClient from "./Postulate.client";
import ApplicationsClient from "./Applications.client";
import ProspectsClient from "./Prospects.client";
import ChatClient from "./Chat.client";
import AgreementsClient from "./Agreements.client";

import Breadcrumbs from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Params = { params: { id: string } };

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

function formatDate(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default async function RequestDetailPage({ params }: Params) {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  const base = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${proto}://${host}` : "http://localhost:3000");

  const res = await fetch(`${base}/api/requests/${params.id}`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-store",
  }).catch<unknown>(e => ({ ok: false, error: e }));

  if (typeof res === "object" && res && "ok" in (res as any) && (res as any).ok === false) {
    const msg = getErrorMessage((res as any).error);
    return <div className="p-6">Error: {msg}</div>;
  }

  let json: any;
  try {
    // @ts-expect-error: fetch puede haber fallado arriba; protegemos acceso
    json = await res.json();
  } catch (e: unknown) {
    return <div className="p-6">Error: {getErrorMessage(e)}</div>;
  }

  if (!json?.ok) {
    return <div className="p-6">{getErrorMessage(json?.error ?? "No encontrado")}</div>;
  }

  const data = json.data as any;
  const attachmentsRaw = Array.isArray(data.attachments) ? data.attachments : [];
  const subcategories = Array.isArray(data.subcategories) ? data.subcategories : [];

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Solicitudes", href: "/requests" },
            { label: data.title ?? "Solicitud" },
          ]}
        />
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{data.title ?? "(sin título)"}</h1>
          <Badge variant="secondary">{data.status ?? "active"}</Badge>
        </div>
        <p className="text-sm text-gray-600">Ciudad: {data.city ?? "—"} · Fecha: {formatDate(data.created_at)}</p>
        {data.description && (
          <Card className="p-4 text-sm leading-6 whitespace-pre-line">
            {data.description}
          </Card>
        )}

        {subcategories?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {subcategories.map((s: any, idx: number) => (
              <Badge key={idx} variant="outline">{typeof s === "string" ? s : s?.name}</Badge>
            ))}
          </div>
        )}

        {attachmentsRaw?.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {await (async () => {
              const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
              const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
              let signed: Array<{ url: string; mime?: string; size?: number }> = [];
              if (url && serviceRole) {
                const admin = createClient(url, serviceRole);
                const items = await Promise.all(
                  attachmentsRaw.map(async (f: any) => {
                    const mime = f?.mime ?? "attachment";
                    const size = f?.size ?? 0;
                    if (f?.path) {
                      const s = await admin.storage.from("requests").createSignedUrl(f.path, 60 * 60).catch(() => null);
                      const href = s?.data?.signedUrl ?? null;
                      if (href) return { url: href, mime, size };
                    }
                    if (f?.url) return { url: f.url as string, mime, size };
                    return null;
                  })
                );
                signed = items.filter(Boolean) as Array<{ url: string; mime?: string; size?: number }>;
              } else {
                // Fallback: usar url si existe
                signed = attachmentsRaw
                  .map((f: any) => (f?.url ? { url: f.url as string, mime: f?.mime, size: f?.size } : null))
                  .filter(Boolean) as Array<{ url: string; mime?: string; size?: number }>;
              }
              return signed.map((f, idx) => (
                <a key={idx} href={f.url} target="_blank" rel="noreferrer" className="block group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.mime ?? "attachment"} className="rounded border object-cover w-full h-40 group-hover:opacity-90" />
                  <p className="text-xs mt-1 text-gray-600 truncate">{f.mime} · {(f.size ?? 0) / 1000} KB</p>
                </a>
              ));
            })()}
          </div>
        )}
      </div>

      <div className="lg:col-span-1 space-y-4">
        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Prospectos</h2>
          <p className="text-sm text-gray-600">Sugeridos por matching/ranking.</p>
          <ProspectsClient requestId={params.id} />
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-medium">¿Eres profesional?</h2>
          <p className="text-sm text-gray-600">Postúlate para que el cliente te contacte. Se aplica RLS.</p>
          <PostulateClient requestId={params.id} />
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Postulaciones</h2>
          <p className="text-sm text-gray-600">Visible sólo para el dueño de la solicitud.</p>
          <ApplicationsClient requestId={params.id} createdBy={data.created_by ?? null} />
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Acuerdos</h2>
          <p className="text-sm text-gray-600">Acuerdos creados para esta solicitud.</p>
          <AgreementsClient requestId={params.id} createdBy={data.created_by ?? null} />
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Chat</h2>
          <p className="text-sm text-gray-600">No compartas datos personales (candado activo).</p>
          <ChatClient requestId={params.id} createdBy={data.created_by ?? null} />
        </Card>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Params) {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  const base = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${proto}://${host}` : "http://localhost:3000");
  try {
    const res = await fetch(`${base}/api/requests/${params.id}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      cache: "no-store",
    });
    const j = await res.json();
    const d = j?.data as { title?: string | null; city?: string | null; description?: string | null; attachments?: Array<any> } | undefined;
    const t = d?.title?.trim() || "Solicitud";
    const city = d?.city ? ` · ${d.city}` : "";
    const descSrc = (d?.description || "").trim();
    const desc = descSrc ? (descSrc.length > 140 ? `${descSrc.slice(0, 137)}…` : descSrc) : `Solicitud en Handee${city}`;
    // OG image: usa primer adjunto (firmado) si existe
    let imageUrl = `${base}/handee-logo.png`;
    try {
      const att = Array.isArray(d?.attachments) ? d!.attachments : [];
      const first = att.find((x) => x && (x.path || x.url)) || null;
      if (first?.path) {
        const urlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
        const sr = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
        if (urlEnv && sr) {
          const admin = createClient(urlEnv, sr);
          const s = await admin.storage.from("requests").createSignedUrl(first.path as string, 60 * 60).catch(() => null);
          if (s?.data?.signedUrl) imageUrl = s.data.signedUrl;
        }
      } else if (first?.url) {
        imageUrl = first.url as string;
      }
    } catch {
      // ignore
    }
    return {
      title: `${t} — Handee`,
      description: desc,
      openGraph: {
        title: `${t} — Handee`,
        description: desc,
        url: `${base}/requests/${params.id}`,
        images: [imageUrl],
        siteName: "Handee",
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: `${t} — Handee`,
        description: desc,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: "Solicitud — Handee" };
  }
}
