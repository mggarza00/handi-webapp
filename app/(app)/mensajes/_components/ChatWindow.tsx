"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import useCompletionReview from "../../_components/_hooks/useCompletionReview";

import formatPresence from "./presence";

import ChatPanel from "@/components/chat/ChatPanel";
import AvatarWithSkeleton from "@/components/ui/AvatarWithSkeleton";
import { normalizeAvatarUrl } from "@/lib/avatar";

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  last_active_at: string | null;
};

export default function ChatWindow({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const [meId, setMeId] = React.useState<string | null>(null);
  const [other, setOther] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [requestTitle, setRequestTitle] = React.useState<string | null>(null);
  const [requestStatus, setRequestStatus] = React.useState<string | null>(null);
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [proId, setProId] = React.useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = (value: boolean) => setIsMobile(value);
    apply(mq.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    const legacy = mq as unknown as {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    if (mq.addEventListener) mq.addEventListener("change", listener);
    else if (legacy.addListener) legacy.addListener(listener);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", listener);
      else if (legacy.removeListener) legacy.removeListener(listener);
    };
  }, []);

  React.useEffect(() => {
    // Oculta tabbars móviles (pro/cliente) cuando estamos dentro del chat detalle
    const cls = "hide-chat-tabbars";
    document.body.classList.add(cls);
    return () => {
      document.body.classList.remove(cls);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      let my: string | null = null;
      try {
        const r = await fetch(`/api/me`, {
          cache: "no-store",
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j?.user?.id) my = j.user.id as string;
        if (!cancelled) setMeId(my);
      } catch {
        // ignore
      }
      try {
        const rh = await fetch(
          `/api/chat/history?conversationId=${encodeURIComponent(conversationId)}&limit=1`,
          {
            headers: { "Content-Type": "application/json; charset=utf-8" },
            cache: "no-store",
            credentials: "include",
          },
        );
        const jh = await rh.json().catch(() => ({}));
        if (cancelled) return;
        const parts = jh?.participants as
          | { customer_id?: string; pro_id?: string }
          | undefined;
        const cid = (parts?.customer_id as string | undefined) ?? null;
        const pid = (parts?.pro_id as string | undefined) ?? null;
        setCustomerId(cid);
        setProId(pid);
        const reqId = (jh?.request_id as string | undefined) ?? null;
        setRequestId(reqId);
        const otherId =
          my && cid && pid ? (my === cid ? pid : cid) : cid || pid || null;
        if (reqId) {
          try {
            const rr = await fetch(`/api/requests/${reqId}`, {
              cache: "no-store",
              credentials: "include",
            });
            const rj = await rr.json().catch(() => ({}));
            const title =
              typeof rj?.data?.title === "string"
                ? (rj.data.title as string)
                : null;
            const status =
              typeof rj?.data?.status === "string"
                ? (rj.data.status as string)
                : null;
            if (!cancelled) {
              setRequestTitle(title);
              setRequestStatus(status);
            }
          } catch {
            /* ignore */
          }
        }

        if (otherId) {
          const rp = await fetch(`/api/profiles/${otherId}`, {
            cache: "no-store",
            credentials: "include",
          });
          const jp = await rp.json().catch(() => ({}));
          if (!cancelled && rp.ok && jp?.data) {
            setOther(jp.data as Profile);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const viewerRole: "client" | "pro" =
    meId && proId && meId === proId ? "pro" : "client";

  // TODO: sustituir conversationId por el requestId real cuando esté disponible en el contexto de la conversación.
  const {
    modal: reviewModal,
    handleCompletionResponse: _handleCompletionResponse,
    open: openReview,
  } = useCompletionReview({
    requestId: requestId ?? conversationId,
    reviewerRole: viewerRole,
    professionalId: proId,
    clientId: customerId,
    status: null, // pásalo a "completed" para autoabrir
    viewerId: meId,
  });

  async function patchStatus(
    nextStatus: "scheduled" | "in_process" | "completed",
  ) {
    if (!requestId) return null;
    const res = await fetch(
      `/api/requests/${encodeURIComponent(requestId)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ nextStatus }),
        credentials: "include",
      },
    );
    const json = await res.json().catch(() => null);
    if (res.ok) {
      const s = (json?.data?.status as string | null) ?? null;
      if (s) setRequestStatus(s);
    }
    return json;
  }

  return (
    <div
      className={
        isMobile
          ? "h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-white"
          : "h-auto md:h-[calc(100vh-8rem)] md:max-h-[calc(100vh-8rem)] md:overflow-auto flex flex-col bg-white"
      }
    >
      <style jsx global>{`
        @media (max-width: 768px) {
          body.hide-chat-tabbars #pro-mobile-tabbar,
          body.hide-chat-tabbars #mobile-client-tabbar {
            display: none !important;
          }
        }
      `}</style>
      {/* Desktop header + actions (hidden on mobile) */}
      {!isMobile ? (
        <>
          <div className="border-b p-3 flex items-center gap-3 sticky top-0 bg-white z-10">
            <AvatarWithSkeleton
              src={
                normalizeAvatarUrl(other?.avatar_url) ||
                "/images/Favicon-v1-jpeg.jpg"
              }
              alt={other?.full_name || "Avatar"}
              sizeClass="size-10"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm truncate">
                  {other?.full_name || ""}
                </div>
                {requestId && viewerRole === "pro" ? (
                  <a
                    href={`/requests/explore/${requestId}`}
                    className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50 shrink-0"
                  >
                    Ir a solicitud
                  </a>
                ) : null}
              </div>
              {(() => {
                const st = (requestStatus || "").toLowerCase();
                const isScheduled = st === "scheduled";
                const isInProcess = st === "in_process" || st === "inprogress";
                const isFinished = st === "finished" || st === "completed";
                const isCanceled = st === "canceled" || st === "cancelled";
                const statusLabel = isScheduled
                  ? "Agendada"
                  : isInProcess
                    ? "En proceso"
                    : isFinished
                      ? "Finalizada"
                      : isCanceled
                        ? "Cancelada"
                        : "Activa";
                return (
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground truncate">
                      {requestTitle ||
                        (loading
                          ? "Cargando…"
                          : formatPresence(other?.last_active_at ?? null))}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline text-xs text-muted-foreground">
                          Estatus:
                        </span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 border">
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Actions by status */}
          {(() => {
            const st = (requestStatus || "").toLowerCase();
            const isScheduled = st === "scheduled";
            const isInProcess = st === "in_process" || st === "inprogress";
            if (!requestId) return null;
            if (viewerRole === "pro") {
              return (
                <div className="border-b bg-white p-2 flex items-center gap-2">
                  {isScheduled ? (
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                      onClick={() => {
                        void patchStatus("in_process");
                      }}
                    >
                      Empezar trabajo
                    </button>
                  ) : null}
                  {isScheduled || isInProcess ? (
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90"
                      onClick={() => {
                        openReview(); /* completar se hará tras reseña manualmente */
                      }}
                    >
                      Trabajo realizado
                    </button>
                  ) : null}
                </div>
              );
            }
            // viewerRole === 'client'
            if (isScheduled || isInProcess) {
              return (
                <div className="border-b bg-white p-2 flex items-center justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90"
                    onClick={() => {
                      openReview(); /* completar se hará tras reseña manualmente */
                    }}
                  >
                    Trabajo realizado
                  </button>
                </div>
              );
            }
            return null;
          })()}
        </>
      ) : null}

      <div
        className={[
          "flex-1 min-h-0",
          isMobile ? "" : "md:overflow-auto md:max-h-none",
        ].join(" ")}
      >
        <ChatPanel
          conversationId={conversationId}
          onClose={() => {
            if (isMobile) router.push("/mensajes");
          }}
          mode={isMobile ? "panel" : "page"}
          ignoreStageLock={!isMobile}
          stickyActionBar={!isMobile}
          userId={meId}
          dataPrefix="chat"
          requestId={requestId}
          hideClientCtas={(() => {
            const st = (requestStatus || "").toLowerCase();
            return (
              st === "scheduled" ||
              st === "in_process" ||
              st === "inprogress" ||
              st === "finished" ||
              st === "completed"
            );
          })()}
        />
      </div>
      {/* Para disparar manualmente tras llamar a /api/services/[id]/complete o confirm */}
      {/* Ejemplo: _handleCompletionResponse(jsonDelEndpoint); */}
      {/* TODO: invoca handleCompletionResponse con la respuesta real al completar el servicio. */}
      {/* Modal de reseña (inyectado). Reemplaza requestId y status con valores reales del servicio. */}
      {reviewModal}
    </div>
  );
}
/* eslint-disable import/order */
