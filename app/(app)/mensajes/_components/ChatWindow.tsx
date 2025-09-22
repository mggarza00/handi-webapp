/* eslint-disable import/order */
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [meId, setMeId] = React.useState<string | null>(null);
  const [other, setOther] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-3 flex items-center gap-3 sticky top-0 bg-white z-10">
        {/* Back button on mobile */}
        <button
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/mensajes");
          }}
          className="md:hidden inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
          aria-label="Volver a Mensajes"
        >
          ← Mensajes
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={other?.avatar_url || "/avatar.png"}
          alt={other?.full_name || "Avatar"}
          className="size-10 rounded-full object-cover border"
        />
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{other?.full_name || "Conversación"}</div>
          <div className="text-xs text-muted-foreground">
            {loading ? "Cargando…" : formatPresence(other?.last_active_at ?? null)}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        <ChatPanel conversationId={conversationId} onClose={() => {}} mode="page" userId={meId} />
      </div>
    </div>
  );
}
/* eslint-disable import/order */
