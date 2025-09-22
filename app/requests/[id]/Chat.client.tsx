"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import { Button } from "@/components/ui/button";
import ChatPanel from "@/components/chat/ChatPanel";

type Props = {
  requestId: string;
  createdBy: string | null;
  initialTitle?: string | null;
};

type ApplicationRow = Record<string, unknown>;

export default function ChatClient({ requestId, createdBy, initialTitle }: Props) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [apps, setApps] = React.useState<ApplicationRow[]>([]);
  const [peerId, setPeerId] = React.useState<string>("");
  const [me, setMe] = React.useState<string | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [requestBudget, setRequestBudget] = React.useState<number | null>(null);
  const [_requestTitle, setRequestTitle] = React.useState<string | null>(
    initialTitle ?? null,
  );
  const [sending, setSending] = React.useState(false);
  const [_offerSignal, setOfferSignal] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled && data?.user?.id) setMe(data.user.id);
      } catch {
        /* ignore */
      }
      try {
        const r = await fetch(`/api/me`, {
          cache: "no-store",
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        if (!cancelled && r.ok && j?.user?.id) setMe(j.user.id as string);
      } catch {
        /* ignore unauth */
      }
      try {
        const r = await fetch(`/api/requests/${requestId}`, {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          cache: "no-store",
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        if (!cancelled && r.ok) {
          const data = j?.data as Record<string, unknown> | undefined;
          const b = Number(data?.budget ?? NaN);
          if (Number.isFinite(b)) setRequestBudget(b);
          if (typeof data?.title === "string") setRequestTitle(data.title as string);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, supabase]);

  React.useEffect(() => {
    (async () => {
      const res = await fetch(`/api/requests/${requestId}/applications`, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { ok: boolean; data?: ApplicationRow[] };
      const rows: ApplicationRow[] = json?.data ?? [];
      setApps(rows);
      const firstId = (rows[0]?.professional_id as string | undefined) ?? "";
      if (me && createdBy && me !== createdBy) {
        setPeerId(createdBy);
      } else if (rows.length === 1 && firstId) {
        setPeerId(firstId);
      }
    })();
  }, [requestId, createdBy, me]);

  const ensureConversation = React.useCallback(
    async ({ open }: { open?: boolean } = {}) => {
      if (conversationId) {
        if (open) setChatOpen(true);
        return conversationId;
      }

      if (!peerId) return null;
      if (!me) {
        const here =
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/";
        router.push(`/auth/sign-in?next=${encodeURIComponent(here)}`);
        return null;
      }

      const isCustomerSelected = createdBy && peerId === createdBy;
      const proId = isCustomerSelected ? me : peerId;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(`/api/chat/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
            ...(session?.access_token
              ? { "x-access-token": session.access_token }
              : {}),
            ...(me ? { "x-user-id": me } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ requestId, proId }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.status === 401) {
          const here =
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : "/";
          router.push(`/auth/sign-in?next=${encodeURIComponent(here)}`);
          return null;
        }
        const conv = j?.data || j?.conversation || null;
        const id = conv?.id as string | undefined;
        if (res.ok && id) {
          setConversationId(id);
          if (open) setChatOpen(true);
          return id;
        }
        toast.error(j?.error || "No se pudo iniciar el chat");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo iniciar el chat";
        toast.error(msg);
      }
      return null;
    },
    [conversationId, createdBy, me, peerId, requestId, router, supabase],
  );

  async function openChat() {
    if (!peerId) return;
    const id = await ensureConversation({ open: true });
    if (id) setChatOpen(true);
  }

  async function handleContract() {
    // Early guard as solicitado
    if (!peerId) return;
    // Validación adicional para UX
    if (!peerId) {
      toast.error("Selecciona primero con quién deseas avanzar");
      return;
    }
    if (!me) {
      const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      router.push(`/auth/sign-in?next=${encodeURIComponent(here)}`);
      return;
    }

    setSending(true);
    try {
      const convId = await ensureConversation({ open: true });
      if (!convId) return;
      setChatOpen(true);
      setOfferSignal((n) => n + 1);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Conversar con:</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={peerId}
            onChange={(event) => setPeerId(event.target.value)}
          >
            <option value="">Selecciona...</option>
            {apps.map((a) => (
              <option
                key={(a.id as string) ?? String(a.professional_id)}
                value={(a.professional_id as string) ?? ""}
              >
                {(a.pro_full_name as string) ?? (a.professional_id as string)}
              </option>
            ))}
            {createdBy ? <option value={createdBy}>Cliente (dueno)</option> : null}
          </select>
          <Button size="sm" onClick={openChat} disabled={!peerId || sending}>
            Abrir chat
          </Button>
          <Button
            size="sm"
            onClick={handleContract}
            disabled={!peerId || sending}
          >
            Contratar
          </Button>
        </div>
        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white w-full text-sm mt-4"
          onClick={handleContract}
          disabled={!peerId || sending}
        >
          {sending ? "Enviando oferta" : "Contratar"}
        </Button>
      </div>
      {chatOpen && conversationId ? (
        <ChatPanel
          key={conversationId}
          conversationId={conversationId}
          userId={me}
          requestId={requestId}
          requestBudget={requestBudget}

          onClose={() => setChatOpen(false)}
        />
      ) : null}
    </>
  );
}

