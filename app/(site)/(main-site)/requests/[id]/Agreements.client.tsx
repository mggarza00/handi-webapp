"use client";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeAvatarUrl } from "@/lib/avatar";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Props = { requestId: string; createdBy?: string | null };

type ProfessionalSummary = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type AgreementItem = {
  id: string;
  professional_id: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  professional: ProfessionalSummary | null;
};

const paidishStatuses = new Set(["paid", "in_progress", "completed"]);
const hiddenStatuses = new Set(["cancelled", "disputed"]);

function statusLabel(status?: string | null) {
  switch (status) {
    case "accepted":
      return "Oferta aceptada";
    case "cancelled":
    case "disputed":
    case "rejected":
      return "Oferta rechazada";
    case "paid":
      return "Servicio agendado";
    case "in_progress":
      return "Servicio pagado y agendado";
    case "completed":
      return "Servicio finalizado";
    case "negotiating":
    default:
      return "Oferta enviada";
  }
}

function timestampFor(item: AgreementItem): number {
  const raw = item.updated_at || item.created_at || "";
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? 0 : ts;
}

function pickMostRecent(items: AgreementItem[]): AgreementItem | null {
  if (!items.length) return null;
  return items.reduce((acc, item) =>
    timestampFor(item) >= timestampFor(acc) ? item : acc,
  );
}

export default function AgreementsClient({ requestId }: Props) {
  const [items, setItems] = React.useState<AgreementItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [nonce, setNonce] = React.useState(0);
  const lastRealtimeAtRef = React.useRef(0);
  const supabase = React.useMemo(() => {
    try {
      return createSupabaseBrowser();
    } catch {
      return null;
    }
  }, []);
  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  const money = React.useMemo(
    () =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
      }),
    [],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/requests/${requestId}/agreements`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
        const json = await res.json();
        if (!res.ok)
          throw new Error(json?.error || "No se pudieron cargar los acuerdos");
        const list: AgreementItem[] = json.data ?? [];
        setItems(list);
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "UNKNOWN");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [requestId, nonce]);

  React.useEffect(() => {
    if (!supabase || !requestId) return;
    const channel = supabase
      .channel(`agreements:${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agreements",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          const now = Date.now();
          if (now - lastRealtimeAtRef.current < 250) return;
          lastRealtimeAtRef.current = now;
          refresh();
          window.dispatchEvent(
            new CustomEvent("agreements:refresh", {
              detail: { requestId, source: "agreements-realtime" },
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "offers",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          const now = Date.now();
          if (now - lastRealtimeAtRef.current < 250) return;
          lastRealtimeAtRef.current = now;
          refresh();
          window.dispatchEvent(
            new CustomEvent("agreements:refresh", {
              detail: { requestId, source: "agreements-realtime" },
            }),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, supabase, refresh]);

  // Escucha eventos para refrescar lista desde otros componentes (e.g., Prospectos)
  React.useEffect(() => {
    function onRefresh(e: Event) {
      const ce = e as CustomEvent<
        string | { requestId?: string; source?: string }
      >;
      const detail = ce?.detail;
      const targetId =
        typeof detail === "string" ? detail : detail?.requestId;
      const source = typeof detail === "string" ? null : detail?.source;
      if (source === "agreements-realtime" && targetId === requestId) return;
      if (!targetId || targetId === requestId) refresh();
    }
    window.addEventListener("agreements:refresh", onRefresh as EventListener);
    return () =>
      window.removeEventListener(
        "agreements:refresh",
        onRefresh as EventListener,
      );
  }, [requestId, refresh]);

  const viewItems = React.useMemo(() => {
    if (!items) return [] as AgreementItem[];
    const visible = items.filter(
      (item) => !hiddenStatuses.has(item.status ?? ""),
    );
    const paidish = visible.filter((item) =>
      paidishStatuses.has(item.status ?? "negotiating"),
    );
    const mostRecent = pickMostRecent(paidish);
    return mostRecent ? [mostRecent] : visible;
  }, [items]);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle>Acuerdos</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm">Cargando acuerdos.</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : viewItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No existen acuerdos por el momento.
          </p>
        ) : (
          <ul className="divide-y">
            {viewItems.map((item) => {
              const name = item.professional?.full_name || "Profesional";
              const avatarSrc =
                normalizeAvatarUrl(item.professional?.avatar_url) ||
                "/images/Favicon-v1-jpeg.jpg";
              return (
                <li key={item.id} className="py-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarSrc}
                      alt={name}
                      className="h-8 w-8 rounded-full border object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate font-medium text-slate-900">
                          {name}
                        </div>
                        <div className="shrink-0 font-semibold text-slate-900">
                          {money.format(item.amount ?? 0)}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {statusLabel(item.status)}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
