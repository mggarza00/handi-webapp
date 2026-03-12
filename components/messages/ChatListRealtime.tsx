"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { useRealtime } from "@/components/messages/RealtimeProvider";
import { toast } from "@/components/ui/use-toast";

export type MessagePayload = {
  conversation_id?: string | null;
  chat_id?: string | null;
  sender_id?: string | null;
  id?: string | null;
  body?: string | null;
  text?: string | null;
  created_at?: string | null;
};

type Props = {
  meId?: string | null;
  ids?: string[]; // conversation ids to filter by (optional). If provided, subscribes per-id.
  onUnreadIncrement: (chatId: string, row: MessagePayload, isActive: boolean) => void;
  getChatTitle?: (chatId: string) => string | null | undefined;
  showToast?: boolean;
  onRecoveryNeeded?: (reason: "reconnected" | "channel-error" | "timed-out" | "closed" | "new-thread") => void;
};

const logRealtimeError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("[ChatListRealtime]", error);
  }
};

export default function ChatListRealtime({ meId, ids, onUnreadIncrement, getChatTitle, showToast = true, onRecoveryNeeded }: Props) {
  const supabase = useRealtime();
  const pathname = usePathname() || "";
  const idsKey = React.useMemo(() => (Array.isArray(ids) && ids.length ? ids.join(",") : "*"), [ids]);
  const channelName = React.useMemo(() => (idsKey === "*" ? "chat:inbox:rt" : `chat:inbox:ids:${idsKey.length}`), [idsKey]);
  const meRef = React.useRef<string | null>(meId ?? null);
  const hadSubscribedRef = React.useRef(false);
  const lastRecoveryAtRef = React.useRef(0);
  React.useEffect(() => { meRef.current = meId ?? null; }, [meId]);

  React.useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      try {
        // Asegura que el cliente tenga un JWT cargado antes de suscribir (RLS en Realtime)
        try {
          await supabase.auth.getSession();
        } catch (error) {
          logRealtimeError(error);
        }
        if (cancelled) return;
        channel = supabase.channel(channelName);
        if (idsKey === "*") {
          channel.on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            (payload) => {
              const row = payload.new as MessagePayload;
              if (process.env.NODE_ENV !== "production") {
                // eslint-disable-next-line no-console
                console.debug("rt inbox insert", row.conversation_id);
              }
              const cid = String(row?.conversation_id ?? row?.chat_id ?? "");
              if (!cid) return;
              if (Array.isArray(ids) && ids.length > 0 && !ids.includes(cid)) {
                onRecoveryNeeded?.("new-thread");
              }
              const senderId = String(row?.sender_id ?? "");
              if (meRef.current && senderId === meRef.current) return; // own message
              const isActive = /\/mensajes\//.test(pathname) && pathname.endsWith(`/${cid}`);
              onUnreadIncrement(cid, row, isActive);
              if (showToast && !isActive) {
                const title = (getChatTitle?.(cid) || "").trim() || "Contacto";
                toast({ title: "Nuevo mensaje", description: `Nuevo mensaje de ${title}`, action: { label: "Abrir chat", href: `/messages/${cid}` }, duration: 4000 });
              }
            },
          );
        } else {
          // Suscribir por cada id para mayor confiabilidad
          const uniq = Array.from(new Set((ids || []).filter(Boolean)));
          for (const cid of uniq) {
            channel.on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${cid}` },
              (payload) => {
                if (process.env.NODE_ENV !== "production") {
                  // eslint-disable-next-line no-console
                  console.debug("rt inbox insert (byid)", cid, (payload.new as { id?: string })?.id);
                }
                const row = payload.new as MessagePayload;
                const senderId = String(row?.sender_id ?? "");
                if (meRef.current && senderId === meRef.current) return;
                const isActive = /\/mensajes\//.test(pathname) && pathname.endsWith(`/${cid}`);
                onUnreadIncrement(cid, row, isActive);
                if (showToast && !isActive) {
                  const title = (getChatTitle?.(cid) || "").trim() || "Contacto";
                  toast({ title: "Nuevo mensaje", description: `Nuevo mensaje de ${title}`, action: { label: "Abrir chat", href: `/messages/${cid}` }, duration: 4000 });
                }
              },
            );
          }
        }
        channel.subscribe((status) => {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("rt inbox status", channelName, status);
          }
          const requestRecovery = (
            reason: "reconnected" | "channel-error" | "timed-out" | "closed",
          ) => {
            const now = Date.now();
            if (now - lastRecoveryAtRef.current < 1500) return;
            lastRecoveryAtRef.current = now;
            onRecoveryNeeded?.(reason);
          };
          if (status === "SUBSCRIBED") {
            if (hadSubscribedRef.current) requestRecovery("reconnected");
            hadSubscribedRef.current = true;
            return;
          }
          if (status === "CHANNEL_ERROR") requestRecovery("channel-error");
          if (status === "TIMED_OUT") requestRecovery("timed-out");
          if (status === "CLOSED") requestRecovery("closed");
        });
      } catch (error) {
        logRealtimeError(error);
      }
    })();
    return () => {
      cancelled = true;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          logRealtimeError(error);
        }
      }
    };
  }, [supabase, channelName, idsKey, ids, pathname, onUnreadIncrement, getChatTitle, showToast, onRecoveryNeeded]);

  return null;
}
