"use client";
import * as React from "react";

type Props = { requestId: string };

export default function OpenChatButton({ requestId }: Props) {
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      // Try to pick a professional from applications
      let proId: string | null = null;
      try {
        const r = await fetch(`/api/requests/${requestId}/applications`, {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          cache: "no-store",
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        const apps = Array.isArray(j?.data) ? (j.data as Array<{ professional_id?: string }>) : [];
        if (apps.length && typeof apps[0]?.professional_id === "string") proId = apps[0].professional_id as string;
      } catch {}

      // If still null, try from agreements
      if (!proId) {
        try {
          const r = await fetch(`/api/requests/${requestId}/agreements`, {
            headers: { "Content-Type": "application/json; charset=utf-8" },
            cache: "no-store",
            credentials: "include",
          });
          const j = await r.json().catch(() => ({}));
          const rows = Array.isArray(j?.data) ? (j.data as Array<{ professional_id?: string }>) : [];
          if (rows.length && typeof rows[0]?.professional_id === "string") proId = rows[0].professional_id as string;
        } catch {}
      }

      // If we have a pro, try to ensure conversation and go to thread view
      if (proId) {
        try {
          const s = await fetch(`/api/chat/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            credentials: "include",
            body: JSON.stringify({ requestId, proId }),
          });
          const sj = await s.json().catch(() => ({}));
          const convId = (sj?.data?.id as string | undefined) || null;
          if (s.ok && convId) {
            window.location.assign(`/mensajes/${convId}`);
            return;
          }
        } catch {}
      }

      // Fallback: go to inbox
      window.location.assign(`/mensajes`);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center rounded border px-3 py-1.5 text-sm hover:bg-neutral-50"
      data-testid="open-request-chat"
    >
      {pending ? "Abriendo…" : "Abrir chat"}
    </button>
  );
}

