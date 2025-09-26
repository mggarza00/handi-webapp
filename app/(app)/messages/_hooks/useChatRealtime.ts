"use client";

import * as React from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

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
    const sb = createClientComponentClient();
    const channel = sb
      .channel(`chat:${conversationId}:rt`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => h.onMessageInsert?.(payload.new as RealtimeMessage),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => h.onMessageUpdate?.(payload.new as RealtimeMessage),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_attachments", filter: `conversation_id=eq.${conversationId}` },
        (payload) => h.onAttachmentInsert?.(payload.new as RealtimeAttachment),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_attachments", filter: `conversation_id=eq.${conversationId}` },
        (payload) => h.onAttachmentDelete?.(payload.old as { id: string; message_id: string; conversation_id: string }),
      )
      .subscribe();
    return () => {
      try { sb.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [conversationId, h]);
}
