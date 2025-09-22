"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

import ChatPanel from "@/components/chat/ChatPanel";
import { Button } from "@/components/ui/button";

export default function ChatStartPro({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [me, setMe] = React.useState<string | null>(null);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/me`, { cache: "no-store", credentials: "include" });
        const j = await r.json().catch(() => ({}));
        if (!cancelled && r.ok && j?.user?.id) setMe(j.user.id as string);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onStart() {
    if (!me) {
      const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      router.push(`/auth/sign-in?next=${encodeURIComponent(here)}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        // Para inicio desde pro: proId = me
        body: JSON.stringify({ requestId, proId: me }),
      });
      const j = await res.json().catch(() => ({}));
      const conv = j?.data || j?.conversation || null;
      const id = conv?.id as string | undefined;
      if (res.ok && id) {
        setConversationId(id);
        setOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={onStart} disabled={loading} className="w-full">
        {loading ? "Abriendo…" : "Enviar mensaje"}
      </Button>
      {open && conversationId ? (
        <ChatPanel
          conversationId={conversationId}
          onClose={() => setOpen(false)}
          mode="panel"
          userId={me}
        />
      ) : null}
    </div>
  );
}
