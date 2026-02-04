"use client";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeAvatarUrl } from "@/lib/avatar";

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

function statusLabel(status?: string | null) {
  switch (status) {
    case "accepted":
      return "Oferta aceptada";
    case "cancelled":
    case "disputed":
    case "rejected":
      return "Oferta rechazada";
    case "paid":
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

  // Escucha eventos para refrescar lista desde otros componentes (e.g., Prospectos)
  React.useEffect(() => {
    function onRefresh(e: Event) {
      const ce = e as CustomEvent<string>;
      const targetId = ce?.detail;
      if (!targetId || targetId === requestId) setNonce((n) => n + 1);
    }
    window.addEventListener("agreements:refresh", onRefresh as EventListener);
    return () =>
      window.removeEventListener(
        "agreements:refresh",
        onRefresh as EventListener,
      );
  }, [requestId]);

  const viewItems = React.useMemo(() => {
    if (!items) return [] as AgreementItem[];
    const paidish = items.filter((item) =>
      paidishStatuses.has(item.status ?? "negotiating"),
    );
    const mostRecent = pickMostRecent(paidish);
    return mostRecent ? [mostRecent] : items;
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
