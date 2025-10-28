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
  onAttachmentDelete?: (row: { id: string; message_id: string; conversation_id: string }) => void; // optional
};

/**
 * Subscribes to realtime inserts on public.messages and public.message_attachments for a conversation.
 * Keeps UI responsive without manual refresh.
 */
  export function useChatRealtime(conversationId: string, h: Handlers) {
  React.useEffect(() => {
    if (!conversationId) return;
    const sb = createSupabaseBrowser();
    const channel = sb
      .channel(`chat:${conversationId}:rt`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("rt message insert", conversationId, (payload.new as { id?: string })?.id);
          }
          h.onMessageInsert?.(payload.new as RealtimeMessage);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          if (process.env.NODE_ENV != "production") { console.debug("rt message update", conversationId, (payload.new as { id?: string })?.id); }
          h.onMessageUpdate?.(payload.new as RealtimeMessage);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_attachments", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          if (process.env.NODE_ENV != "production") {
            console.debug("rt attachment insert", conversationId, (payload.new as { message_id?: string })?.message_id, (payload.new as { id?: string })?.id);
          }
          h.onAttachmentInsert?.(payload.new as RealtimeAttachment);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_attachments", filter: `conversation_id=eq.${conversationId}` },
        (payload) => h.onAttachmentDelete?.(payload.old as { id: string; message_id: string; conversation_id: string }),
      )
      // DEV-only broad listener (no filter) to diagnose filtering issues. Remove after validation.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_attachments" },
        (payload) => {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug(
              "rt dev raw att insert",
              (payload.new as { conversation_id?: string })?.conversation_id,
              (payload.new as { message_id?: string })?.message_id,
              (payload.new as { id?: string })?.id,
            );
          }
        },
      )
      // DEV-only broad listener (no filter) to verify any insert visibility
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug(
              "rt dev raw msg insert",
              (payload.new as { conversation_id?: string })?.conversation_id,
              (payload.new as { id?: string })?.id,
            );
          }
        },
      )
      .subscribe();
    if (process.env.NODE_ENV != "production") { console.debug("rt sub to conv", conversationId); }
    return () => {
      try { sb.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [conversationId, h]);
}
