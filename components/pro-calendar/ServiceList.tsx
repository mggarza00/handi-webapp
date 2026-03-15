"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { ScheduledService } from "./types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openAssistant } from "@/lib/assistant/events";
import FinishJobTrigger from "@/components/services/FinishJobTrigger.client";

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

export default function ServiceList({
  services,
}: {
  services: ScheduledService[];
}) {
  const router = useRouter();
  const todayKey = React.useMemo(
    () => new Date().toISOString().slice(0, 10),
    [],
  );
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [helpBusy, setHelpBusy] = React.useState<null | "talk" | "no-response">(
    null,
  );
  const [helpContext, setHelpContext] = React.useState<{
    requestId: string;
    serviceTitle: string;
  } | null>(null);
  const myIdRef = React.useRef<string | null>(null);

  const groups = React.useMemo<ServiceGroup[]>(() => {
    const normalized: NormalizedService[] = services
      .filter((e) => typeof e.scheduled_at === "string" && e.scheduled_at)
      .map((service) => {
        const dateKey = service.scheduled_at!.slice(0, 10);
        return { ...service, dateKey, isPast: dateKey < todayKey };
      })
      .sort((a, b) =>
        a.scheduled_at < b.scheduled_at
          ? -1
          : a.scheduled_at > b.scheduled_at
            ? 1
            : 0,
      );

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

  const resolveMyId = React.useCallback(async (): Promise<string | null> => {
    if (myIdRef.current) return myIdRef.current;
    try {
      const res = await fetch("/api/me", {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      const id = typeof json?.user?.id === "string" ? json.user.id : null;
      myIdRef.current = id;
      return id;
    } catch {
      return null;
    }
  }, []);

  const ensureConversationAndOpen = React.useCallback(
    async (requestId: string, prefillMessage?: string) => {
      const proId = await resolveMyId();
      if (!proId) {
        router.push("/mensajes");
        return;
      }
      try {
        const res = await fetch("/api/conversations/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          credentials: "include",
          body: JSON.stringify({
            requestId,
            proId,
            redirect: false,
          }),
        });
        const json = await res.json().catch(() => ({}));
        const conversationId = typeof json?.id === "string" ? json.id : null;
        if (!res.ok || !conversationId) {
          router.push("/mensajes");
          return;
        }
        if (prefillMessage && prefillMessage.trim().length > 0) {
          router.push(
            `/mensajes/${encodeURIComponent(conversationId)}?prefill=${encodeURIComponent(prefillMessage.trim())}`,
          );
          return;
        }
        router.push(`/mensajes/${encodeURIComponent(conversationId)}`);
      } catch {
        router.push("/mensajes");
      }
    },
    [resolveMyId, router],
  );

  const openHelpMenu = React.useCallback(
    (requestId: string, serviceTitle: string) => {
      setHelpContext({ requestId, serviceTitle });
      setHelpOpen(true);
    },
    [],
  );

  const handleTalkToClient = React.useCallback(async () => {
    if (!helpContext || helpBusy) return;
    setHelpBusy("talk");
    try {
      setHelpOpen(false);
      await ensureConversationAndOpen(helpContext.requestId);
    } finally {
      setHelpBusy(null);
    }
  }, [ensureConversationAndOpen, helpBusy, helpContext]);

  const handleClientNoResponse = React.useCallback(async () => {
    if (!helpContext || helpBusy) return;
    setHelpBusy("no-response");
    try {
      setHelpOpen(false);
      await ensureConversationAndOpen(
        helpContext.requestId,
        "Hola, intento confirmar el servicio programado pero no he recibido respuesta. ¿Podemos confirmar o reprogramar el horario?",
      );
    } finally {
      setHelpBusy(null);
    }
  }, [ensureConversationAndOpen, helpBusy, helpContext]);

  const handleServiceProblem = React.useCallback(() => {
    if (!helpContext) return;
    const safeTitle = helpContext.serviceTitle?.trim() || "este servicio";
    const preset = `Necesito ayuda con el servicio '${safeTitle}'. Tuve un problema durante el trabajo.`;
    setHelpOpen(false);
    openAssistant({ message: preset });
  }, [helpContext]);

  const handleWhatsAppSupport = React.useCallback(() => {
    const text =
      "Hola, soy un profesional de Handi y necesito ayuda con un servicio.";
    const url = `https://wa.me/528130878691?text=${encodeURIComponent(text)}`;
    setHelpOpen(false);
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleViewRequest = React.useCallback(
    (requestId: string) => {
      router.push(`/requests/explore/${requestId}`);
    },
    [router],
  );

  if (groups.length === 0) {
    return (
      <div className="text-sm text-slate-600">No hay servicios agendados.</div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const separatorLabel = group.isToday
          ? "Hoy"
          : format(group.date, "dd/MM/yyyy", { locale: es });
        const separatorColor = group.isToday ? "text-sky-600" : "text-blue-900";
        const separatorBorder = group.isToday
          ? "border-sky-200"
          : "border-blue-200";
        return (
          <div key={group.dateKey} className="space-y-3">
            <div
              className={`flex items-center gap-3 text-sm font-semibold uppercase tracking-wide ${separatorColor}`}
            >
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
                const canFinish = ["scheduled", "in_process"].includes(
                  String(ev.status || "").toLowerCase(),
                );
                return (
                  <li key={`${ev.id}-${i}`}>
                    <Card
                      className={
                        ev.isPast
                          ? "border-orange-200 bg-orange-50/60"
                          : undefined
                      }
                    >
                      <CardHeader className="pb-2">
                        <CardTitle
                          className={`text-base flex items-center gap-2 ${ev.isPast ? "text-orange-600" : ""}`}
                        >
                          <span className="truncate">
                            {ev.title || "Servicio"}
                          </span>
                          <Badge
                            variant="secondary"
                            className={
                              ev.isPast
                                ? "bg-orange-100 text-orange-700 border-orange-200"
                                : undefined
                            }
                          >
                            {ev.status || "scheduled"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 text-xs text-slate-600 space-y-1">
                            <p>{infoParts.join(" - ")}</p>
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
                                  <FinishJobTrigger
                                    requestId={ev.id}
                                    requestTitle={ev.title}
                                    requestStatus={ev.status ?? null}
                                    clientName={ev.client_name ?? null}
                                    buttonLabel="Trabajo finalizado"
                                    buttonClassName="bg-brand text-white hover:opacity-90"
                                    onCompleted={() => router.refresh()}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openHelpMenu(
                                        ev.id,
                                        ev.title || "Servicio",
                                      )
                                    }
                                  >
                                    Necesito ayuda
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-wrap justify-end gap-2">
                                {canFinish ? (
                                  <FinishJobTrigger
                                    requestId={ev.id}
                                    requestTitle={ev.title}
                                    requestStatus={ev.status ?? null}
                                    clientName={ev.client_name ?? null}
                                    buttonLabel="Trabajo finalizado"
                                    buttonVariant="outline"
                                    onCompleted={() => router.refresh()}
                                  />
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewRequest(ev.id)}
                                >
                                  Ver solicitud
                                </Button>
                              </div>
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
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Qué necesitas hacer?</DialogTitle>
            <DialogDescription>
              Elige una acción para continuar con este servicio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleTalkToClient()}
              disabled={helpBusy !== null}
              className="w-full rounded-lg border p-3 text-left hover:bg-slate-50 disabled:opacity-60"
            >
              <p className="text-sm font-semibold text-slate-900">
                Hablar con el cliente
              </p>
              <p className="text-xs text-slate-600">
                Abrir chat directo con el cliente de este servicio.
              </p>
            </button>
            <button
              type="button"
              onClick={() => void handleClientNoResponse()}
              disabled={helpBusy !== null}
              className="w-full rounded-lg border p-3 text-left hover:bg-slate-50 disabled:opacity-60"
            >
              <p className="text-sm font-semibold text-slate-900">
                El cliente no responde
              </p>
              <p className="text-xs text-slate-600">
                Necesito confirmar o reprogramar el servicio.
              </p>
            </button>
            <button
              type="button"
              onClick={handleServiceProblem}
              disabled={helpBusy !== null}
              className="w-full rounded-lg border p-3 text-left hover:bg-slate-50 disabled:opacity-60"
            >
              <p className="text-sm font-semibold text-slate-900">
                Problema con el servicio
              </p>
              <p className="text-xs text-slate-600">
                Algo salió mal con este trabajo.
              </p>
            </button>
            <button
              type="button"
              onClick={handleWhatsAppSupport}
              disabled={helpBusy !== null}
              className="w-full rounded-lg border p-3 text-left hover:bg-slate-50 disabled:opacity-60"
            >
              <p className="text-sm font-semibold text-slate-900">
                Contactar soporte de Handi
              </p>
              <p className="text-xs text-slate-600">
                Hablar con soporte por WhatsApp.
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
