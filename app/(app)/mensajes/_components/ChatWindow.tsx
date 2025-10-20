"use client";

import * as React from "react";

import useCompletionReview from "../../_components/_hooks/useCompletionReview";
import AvatarWithSkeleton from "@/components/ui/AvatarWithSkeleton";
import { normalizeAvatarUrl } from "@/lib/avatar";
import ChatPanel from "@/components/chat/ChatPanel";

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  last_active_at: string | null;
};

function formatPresence(lastActiveAt: string | null): string {
  if (!lastActiveAt) return "Sin actividad reciente";
  const d = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 3) return "En línea";
  if (mins < 60) return `Activo hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Activo hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Activo hace ${days}d`;
}

export default function ChatWindow({ conversationId }: { conversationId: string }) {
  const [meId, setMeId] = React.useState<string | null>(null);
  const [other, setOther] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [requestTitle, setRequestTitle] = React.useState<string | null>(null);
  const [requestStatus, setRequestStatus] = React.useState<string | null>(null);
  const [requestId, setRequestId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Get my id
        let my: string | null = null;
        try {
          const r = await fetch(`/api/me`, { cache: "no-store", credentials: "include" });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j?.user?.id) my = j.user.id as string;
        } catch {
          // ignore
        }
        if (!my) my = null;
        if (!cancelled) setMeId(my);

        // 2) Get participants from history (limit 1 is enough to get participants)
        const rh = await fetch(
          `/api/chat/history?conversationId=${encodeURIComponent(conversationId)}&limit=1`,
          { headers: { "Content-Type": "application/json; charset=utf-8" }, cache: "no-store", credentials: "include" },
        );
        const jh = await rh.json().catch(() => ({}));
        const parts = jh?.participants as { customer_id?: string; pro_id?: string } | undefined;
        const cid = parts?.customer_id as string | undefined;
        const pid = parts?.pro_id as string | undefined;
        const otherId = my && cid && pid ? (my === cid ? pid : cid) : (cid || pid || null);
        if (!otherId) return;
        const reqId = (jh?.request_id as string | undefined) ?? null;
        if (reqId) {
          if (!cancelled) setRequestId(reqId);
          try {
            const rr = await fetch(`/api/requests/${reqId}`, { cache: "no-store", credentials: "include" });
            const rj = await rr.json().catch(() => ({}));
            const title = typeof rj?.data?.title === "string" ? (rj.data.title as string) : null;
            if (!cancelled) setRequestTitle(title);
            const status = typeof rj?.data?.status === "string" ? (rj.data.status as string) : null;
            if (!cancelled) setRequestStatus(status);
          } catch {
            /* ignore */
          }
        }

        // 3) Load profile of other participant
        const rp = await fetch(`/api/profiles/${otherId}`, { cache: "no-store", credentials: "include" });
        const jp = await rp.json().catch(() => ({}));
        if (rp.ok && jp?.data) {
          const p = jp.data as Profile;
          if (!cancelled) setOther(p);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Infer viewer role from participants (best-effort). Replace requestId with the real one when available.
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [proId, setProId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rh = await fetch(
          `/api/chat/history?conversationId=${encodeURIComponent(conversationId)}&limit=1`,
          { headers: { "Content-Type": "application/json; charset=utf-8" }, cache: "no-store", credentials: "include" },
        );
        const jh = await rh.json().catch(() => ({}));
        const parts = jh?.participants as { customer_id?: string; pro_id?: string } | undefined;
        const cid = (parts?.customer_id as string | undefined) ?? null;
        const pid = (parts?.pro_id as string | undefined) ?? null;
        if (!cancelled) {
          setCustomerId(cid);
          setProId(pid);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const viewerRole: "client" | "pro" =
    meId && proId && meId === proId ? "pro" : "client";

  // TODO: sustituir conversationId por el requestId real cuando esté disponible en el contexto de la conversación.
  const { modal: reviewModal, handleCompletionResponse: _handleCompletionResponse, open: openReview } = useCompletionReview({
    requestId: requestId ?? conversationId,
    reviewerRole: viewerRole,
    professionalId: proId,
    clientId: customerId,
    status: null, // pásalo a "completed" para autoabrir
    viewerId: meId,
  });

  async function patchStatus(nextStatus: 'scheduled'|'in_process'|'completed') {
    if (!requestId) return null;
    const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ nextStatus }),
      credentials: 'include',
    });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      const s = (json?.data?.status as string | null) ?? null;
      if (s) setRequestStatus(s);
    }
    return json;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-3 flex items-center gap-3 sticky top-0 bg-white z-10">
        {/* Avatar con skeleton mientras carga */}
        <AvatarWithSkeleton src={normalizeAvatarUrl(other?.avatar_url) || "/images/Favicon-v1-jpeg.jpg"} alt={other?.full_name || "Avatar"} sizeClass="size-10" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{other?.full_name || ""}</div>
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
                  {requestTitle || (loading ? "Cargando…" : formatPresence(other?.last_active_at ?? null))}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline text-xs text-muted-foreground">Estatus:</span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 border">
                    {statusLabel}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Actions by status */}
      {(() => {
        const st = (requestStatus || '').toLowerCase();
        const isActive = st === 'active' || st === 'pending';
        const isScheduled = st === 'scheduled';
        const isInProcess = st === 'in_process' || st === 'inprogress';
        const isFinished = st === 'finished' || st === 'completed';
        if (!requestId) return null;
        if (viewerRole === 'pro') {
          return (
            <div className="border-b bg-white p-2 flex items-center gap-2">
              {isScheduled ? (
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={() => { void patchStatus('in_process'); }}
                >
                  Empezar trabajo
                </button>
              ) : null}
              {(isScheduled || isInProcess) ? (
                <button
                  type="button"
                  className="inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90"
                  onClick={() => { openReview(); /* completar se hará tras reseña manualmente */ }}
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
                onClick={() => { openReview(); /* completar se hará tras reseña manualmente */ }}
              >
                Trabajo realizado
              </button>
            </div>
          );
        }
        return null;
      })()}

      {/* Body */}
      <div className="flex-1 min-h-0">
        <ChatPanel
          conversationId={conversationId}
          onClose={() => {}}
          mode="page"
          userId={meId}
          dataPrefix="chat"
          hideClientCtas={(() => {
            const st = (requestStatus || '').toLowerCase();
            return st === 'scheduled' || st === 'in_process' || st === 'inprogress' || st === 'finished' || st === 'completed';
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
