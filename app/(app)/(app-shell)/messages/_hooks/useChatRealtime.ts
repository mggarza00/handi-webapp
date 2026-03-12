"use client";

import * as React from "react";

import { createSupabaseBrowser } from "@/lib/supabase/client";

export type RealtimeMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body?: string | null;
  text?: string | null;
  created_at: string;
  read_by?: unknown[];
  message_type?: string | null;
  payload?: unknown;
};

export type RealtimeAttachment = {
  id: string;
  message_id: string;
  conversation_id: string;
  filename: string;
  mime_type: string;
  byte_size?: number | null;
  width?: number | null;
  height?: number | null;
  storage_path: string;
  created_at?: string;
};

export type Handlers = {
  onMessageInsert?: (row: RealtimeMessage) => void;
  onAttachmentInsert?: (row: RealtimeAttachment) => void;
  onMessageUpdate?: (row: RealtimeMessage) => void; // optional
  onAttachmentDelete?: (row: {
    id: string;
    message_id: string;
    conversation_id: string;
  }) => void; // optional
  onStatusChange?: (status: string) => void;
  onRecoverNeeded?: (reason: "reconnected" | "channel-error" | "timed-out" | "closed") => void;
};

/**
 * Subscribes to realtime inserts on public.messages and public.message_attachments for a conversation.
 * Keeps UI responsive without manual refresh.
 */
export function useChatRealtime(conversationId: string, h: Handlers) {
  const handlersRef = React.useRef<Handlers>(h);
  handlersRef.current = h;
  const hadSubscribedRef = React.useRef(false);
  const lastRecoverAtRef = React.useRef(0);

  React.useEffect(() => {
    if (!conversationId) return;
    hadSubscribedRef.current = false;
    const sb = createSupabaseBrowser();
    const requestRecover = (
      reason: "reconnected" | "channel-error" | "timed-out" | "closed",
    ) => {
      const now = Date.now();
      // Prevent tight loops when realtime flaps.
      if (now - lastRecoverAtRef.current < 1500) return;
      lastRecoverAtRef.current = now;
      handlersRef.current?.onRecoverNeeded?.(reason);
    };
    const channel = sb
      .channel(`chat:${conversationId}:rt`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug(
              "rt message insert",
              conversationId,
              (payload.new as { id?: string })?.id,
            );
          }
          handlersRef.current?.onMessageInsert?.(
            payload.new as RealtimeMessage,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (process.env.NODE_ENV != "production") {
            console.debug(
              "rt message update",
              conversationId,
              (payload.new as { id?: string })?.id,
            );
          }
          handlersRef.current?.onMessageUpdate?.(
            payload.new as RealtimeMessage,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_attachments",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (process.env.NODE_ENV != "production") {
            console.debug(
              "rt attachment insert",
              conversationId,
              (payload.new as { message_id?: string })?.message_id,
              (payload.new as { id?: string })?.id,
            );
          }
          handlersRef.current?.onAttachmentInsert?.(
            payload.new as RealtimeAttachment,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_attachments",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) =>
          handlersRef.current?.onAttachmentDelete?.(
            payload.old as {
              id: string;
              message_id: string;
              conversation_id: string;
            },
          ),
      )
      .subscribe((status) => {
        handlersRef.current?.onStatusChange?.(status);
        if (status === "SUBSCRIBED") {
          if (hadSubscribedRef.current) {
            requestRecover("reconnected");
          }
          hadSubscribedRef.current = true;
          return;
        }
        if (status === "CHANNEL_ERROR") requestRecover("channel-error");
        if (status === "TIMED_OUT") requestRecover("timed-out");
        if (status === "CLOSED") requestRecover("closed");
      });
    if (process.env.NODE_ENV != "production") {
      console.debug("rt sub to conv", conversationId);
    }
    return () => {
      try {
        sb.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [conversationId]);
}
