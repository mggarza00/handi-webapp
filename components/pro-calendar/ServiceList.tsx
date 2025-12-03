"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

import type { ScheduledService } from "./types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { openAssistant } from "@/lib/assistant/events";

type NormalizedService = ScheduledService & {
  dateKey: string;
  isPast: boolean;
};

type ServiceGroup = {
  dateKey: string;
  date: Date;
  isToday: boolean;
  items: NormalizedService[];
};

export default function ServiceList({ services }: { services: ScheduledService[] }) {
  const router = useRouter();
  const todayKey = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [pendingRequestId, setPendingRequestId] = React.useState<string | null>(null);

  const groups = React.useMemo<ServiceGroup[]>(() => {
    const normalized: NormalizedService[] = services
      .filter((e) => typeof e.scheduled_at === "string" && e.scheduled_at)
      .map((service) => {
        const dateKey = service.scheduled_at!.slice(0, 10);
        return { ...service, dateKey, isPast: dateKey < todayKey };
      })
      .sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : a.scheduled_at > b.scheduled_at ? 1 : 0));

    const byDate = new Map<string, ServiceGroup>();
    normalized.forEach((item) => {
      if (!byDate.has(item.dateKey)) {
        byDate.set(item.dateKey, {
          dateKey: item.dateKey,
          date: new Date(`${item.dateKey}T00:00:00`),
          isToday: item.dateKey === todayKey,
          items: [],
        });
      }
      byDate.get(item.dateKey)!.items.push(item);
    });
    return Array.from(byDate.values());
  }, [services, todayKey]);

  const handleMarkCompleted = React.useCallback(async (requestId: string) => {
    setPendingRequestId(requestId);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({ nextStatus: "completed" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error || "No se pudo actualizar el estado");
        return;
      }
      toast.success("Trabajo marcado como realizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error de red");
    } finally {
      setPendingRequestId((prev) => (prev === requestId ? null : prev));
    }
  }, []);

  const handleNeedHelp = React.useCallback((requestId: string) => {
    const preset = `Tuve un problema con la solicitud ${requestId}. Necesito que notifiques a profiles.admin y que abras un nuevo chat en /mensajes para comunicarme directamente con el profesional.`;
    openAssistant({ message: preset });
  }, []);

  const handleViewRequest = React.useCallback(
    (requestId: string) => {
      router.push(`/requests/explore/${requestId}`);
    },
    [router],
  );

  if (groups.length === 0) {
    return <div className="text-sm text-slate-600">No hay servicios agendados.</div>;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const separatorLabel = group.isToday ? "Hoy" : format(group.date, "dd/MM/yyyy", { locale: es });
        const separatorColor = group.isToday ? "text-sky-600" : "text-blue-900";
        const separatorBorder = group.isToday ? "border-sky-200" : "border-blue-200";
        return (
          <div key={group.dateKey} className="space-y-3">
            <div className={`flex items-center gap-3 text-sm font-semibold uppercase tracking-wide ${separatorColor}`}>
              <span>{separatorLabel}</span>
              <div className={`flex-1 border-t ${separatorBorder}`} />
            </div>
            <ul className="space-y-3">
              {group.items.map((ev, i) => {
                const dt = ev.scheduled_at ? new Date(ev.scheduled_at) : null;
                const dateLabel = dt ? format(dt, "PPP", { locale: es }) : "";
                const infoParts = [
                  dateLabel || null,
                  ev.city || null,
                  ev.client_name || "Cliente",
                ].filter(Boolean);
                return (
                  <li key={`${ev.id}-${i}`}>
                    <Card className={ev.isPast ? "border-orange-200 bg-orange-50/60" : undefined}>
                      <CardHeader className="pb-2">
                        <CardTitle className={`text-base flex items-center gap-2 ${ev.isPast ? "text-orange-600" : ""}`}>
                          <span className="truncate">{ev.title || "Servicio"}</span>
                          <Badge
                            variant="secondary"
                            className={ev.isPast ? "bg-orange-100 text-orange-700 border-orange-200" : undefined}
                          >
                            {ev.status || "scheduled"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 text-xs text-slate-600 space-y-1">
                            <p>{infoParts.join(" · ")}</p>
                            {ev.isPast ? (
                              <button
                                type="button"
                                onClick={() => handleViewRequest(ev.id)}
                                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                              >
                                Ver solicitud
                              </button>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {ev.isPast ? (
                              <>
                                <span className="text-xs font-semibold uppercase text-orange-500">
                                  Servicio atrasado
                                </span>
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-brand text-white hover:opacity-90"
                                    onClick={() => handleMarkCompleted(ev.id)}
                                    disabled={pendingRequestId === ev.id}
                                  >
                                    {pendingRequestId === ev.id ? "Procesando…" : "Trabajo finalizado"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleNeedHelp(ev.id)}
                                  >
                                    Necesito ayuda
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleViewRequest(ev.id)}>
                                Ver solicitud
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
