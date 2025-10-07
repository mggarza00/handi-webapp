"use client";
/* eslint-disable import/order */
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ChatListItem from "./ChatListItem";
import type { ChatSummary } from "./types";
import { Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ChatList({ chats }: { chats: ChatSummary[] }) {
  const initial = useMemo(() => (Array.isArray(chats) ? chats : []), [chats]);
  const [items, setItems] = useState<ChatSummary[]>(initial);
  const [editing, setEditing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const itemsRef = useRef<ChatSummary[]>(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pathname = usePathname() || "";
  const activeId = React.useMemo(() => {
    const m = pathname.match(/\/mensajes\/([^/?#]+)/i);
    return m ? m[1] : null;
  }, [pathname]);
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store", credentials: "include" });
        const j = await r.json().catch(() => ({}));
        if (!cancelled && r.ok && j?.user?.id) setMeId(String(j.user.id));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  // Clear unread on navigation into a conversation
  useEffect(() => {
    if (!activeId) return;
    setItems((prev) => prev.map((c) => (c.id === activeId ? { ...c, unread: false, unreadCount: 0 } : c)));
  }, [activeId]);

  // Realtime: listen to incoming messages for all conversations and update UI
  useEffect(() => {
    const channel = supabaseBrowser
      .channel("chat:inbox:rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as unknown as {
            id?: string;
            conversation_id?: string;
            sender_id?: string;
            body?: string | null;
            text?: string | null;
            created_at?: string;
          };
          const cid = (row.conversation_id || "").toString();
          if (!cid) return;
          const list = itemsRef.current || [];
          const idx = list.findIndex((c) => c.id === cid);
          if (idx === -1) return; // not in sidebar list, ignore
          const isIncoming = meId ? (row.sender_id || "").toString() !== meId : true;
          if (!isIncoming) return;
          const isActive = activeIdRef.current === cid;
          const body = typeof row.body === "string" && row.body.trim().length
            ? row.body
            : (typeof row.text === "string" ? row.text : "");

          setItems((prev) => {
            const copy = [...prev];
            const i = copy.findIndex((c) => c.id === cid);
            if (i === -1) return prev;
            const prevItem = copy[i];
            const nextCount = (prevItem.unreadCount ?? (prevItem.unread ? 1 : 0)) + (isActive ? 0 : 1);
            copy[i] = {
              ...prevItem,
              preview: body || prevItem.preview || prevItem.requestTitle || prevItem.title,
              lastMessageAt: row.created_at ? String(row.created_at) : prevItem.lastMessageAt,
              unread: isActive ? false : true,
              unreadCount: isActive ? 0 : Math.min(nextCount, 99),
            } as ChatSummary;
            return copy;
          });

          if (!isActive) {
            const id = cid;
            setFlash((prev) => {
              const s = new Set(prev);
              s.add(id);
              return s;
            });
            // one-shot timer to clear flash in ~1.2s
            const existing = timersRef.current.get(id);
            if (existing) clearTimeout(existing);
            const t = setTimeout(() => {
              setFlash((prev) => {
                if (!prev.has(id)) return prev;
                const s = new Set(prev);
                s.delete(id);
                return s;
              });
              timersRef.current.delete(id);
            }, 1300);
            timersRef.current.set(id, t);
            try {
              const title = list[idx]?.title || "";
              toast({
                title: "Nuevo mensaje",
                description: `Nuevo mensaje de ${title}`,
                action: { label: "Abrir chat", href: `/messages/${cid}` },
                duration: 4000,
              });
            } catch { /* ignore */ }
          }
        },
      )
      .subscribe();
    return () => {
      try { supabaseBrowser.removeChannel(channel); } catch { /* ignore */ }
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, [meId]);

  const onDelete = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        const msg = data?.error || "No se pudo eliminar el chat";
        throw new Error(msg);
      }
      // activar animación de salida antes de quitar del estado
      setBusyId(null);
      setRemovingId(id);
      setTimeout(() => {
        setItems((prev) => prev.filter((c) => c.id !== id));
        setRemovingId(null);
      }, 300);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert((e as Error).message || "Error eliminando chat");
    } finally {
      // si hubo error, liberar busy aquí; si no, ya se liberó antes
      setBusyId((curr) => (curr === id ? null : curr));
    }
  };

  if (!items.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Sin mensajes todavía.</div>
    );
  }

  return (
    <div className="flex flex-col bg-[#fbfbfb]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-blue-100/50 bg-[#fbfbfb] sticky top-0 z-10">
        <div className="font-medium text-sm text-slate-700">Chats</div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-100/50 hover:bg-blue-100/20"
        >
          {editing ? "Listo" : "Editar"}
        </button>
      </div>
      <ul className="divide-y" data-testid="chat-thread-list" aria-live="polite" aria-relevant="additions text">
        {items.map((c) => (
          <ChatListItem
            key={c.id}
            chatId={c.id}
            avatarUrl={c.avatarUrl}
            displayName={(c.title || '').trim() || 'Contacto'}
            lastMessageSnippet={typeof c.preview === 'string' ? c.preview : c.requestTitle}
            lastMessageAt={c.lastMessageAt}
            unreadCount={typeof c.unreadCount === 'number' ? c.unreadCount : (c.unread ? 1 : 0)}
            isActive={activeId === c.id}
            isNewArrival={flash.has(c.id)}
            editing={editing}
            deleting={busyId === c.id}
            removing={removingId === c.id}
            onDelete={() => onDelete(c.id)}
            DeleteIcon={Trash2}
          />
        ))}
      </ul>
    </div>
  );
}
