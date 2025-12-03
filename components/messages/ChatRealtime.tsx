"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { useRealtime } from "@/components/messages/RealtimeProvider";
import { toast } from "@/components/ui/use-toast";

type Props = {
  chatId: string;
  meId?: string | null;
  onNewMessage: (message: MessageRow) => void;
  showToastWhenNotFocused?: boolean;
};

type MessageRow = {
  sender_id?: string | null;
} & Record<string, unknown>;

const logRealtimeError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("[ChatRealtime]", error);
  }
};

/**
 * ChatRealtime: Suscribe INSERTs en public.messages para un chat específico.
 * Llama onNewMessage al instante y (opcional) dispara toast si no estás en la vista del chat.
 * Nota: ChatPanel ya maneja realtime. Usa este componente solo si necesitas una capa separada.
 */
export function ChatRealtime({ chatId, meId, onNewMessage, showToastWhenNotFocused = false }: Props) {
  const sb = useRealtime();
  const pathname = usePathname() || "";
  React.useEffect(() => {
    if (!chatId) return;
    const channel = sb
      .channel(`chat:${chatId}:single`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${chatId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          const senderId = typeof row.sender_id === "string" ? row.sender_id : String(row.sender_id ?? "");
          const isMine = meId && senderId === meId;
          onNewMessage(row);
          if (showToastWhenNotFocused && !isMine) {
            const onThisPage = /\/mensajes\//.test(pathname) && pathname.endsWith(`/${chatId}`);
            if (!onThisPage) {
              toast({ title: "Nuevo mensaje", description: "Nuevo mensaje recibido" });
            }
          }
        },
      )
      .subscribe();
    return () => {
      try {
        sb.removeChannel(channel);
      } catch (error) {
        logRealtimeError(error);
      }
    };
  }, [sb, chatId, meId, pathname, onNewMessage, showToastWhenNotFocused]);
  return null;
}

export default ChatRealtime;
