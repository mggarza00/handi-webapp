"use client";
/* eslint-disable import/order */
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import ChatListItem from "./ChatListItem";
import type { ChatSummary } from "./types";
import { Trash2 } from "lucide-react";

export default function ChatList({ chats }: { chats: ChatSummary[] }) {
  const initial = useMemo(() => (Array.isArray(chats) ? chats : []), [chats]);
  const [items, setItems] = useState<ChatSummary[]>(initial);
  const [editing, setEditing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

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
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white sticky top-0 z-10">
        <div className="font-medium text-sm text-muted-foreground">Chats</div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-neutral-50"
        >
          {editing ? "Listo" : "Editar"}
        </button>
      </div>
      <ul className="divide-y">
        {items.map((c) => (
          <ChatListItem
            key={c.id}
            chat={c}
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


