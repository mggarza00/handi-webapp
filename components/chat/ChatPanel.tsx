/* eslint-disable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import ChatUploader from "@/app/(app)/messages/_components/ChatUploader";
import { getContactPolicyMessage } from "@/lib/safety/policy";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { appendAttachment, removeAttachment } from "@/components/chat/utils";
import { useChatRealtime } from "@/app/(app)/messages/_hooks/useChatRealtime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
type Msg = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  readBy?: string[];
  messageType: string;
  payload: Record<string, unknown> | null;
  attachments?: Array<{
    id?: string;
    filename: string;
    mime_type: string;
    byte_size?: number | null;
    width?: number | null;
    height?: number | null;
    storage_path: string;
    created_at?: string;
  }>;
};
type Participants = { customer_id: string; pro_id: string };
type HistoryResponse = {
  ok?: boolean;
  data?: unknown[];
  error?: string;
  participants?: Participants | null;
  request_id?: string | null;
};
export type ChatPanelProps = {
  conversationId: string;
  onClose: () => void;
  mode?: "panel" | "page";
  userId?: string | null;
  requestId?: string | null;
  requestBudget?: number | null;
  dataPrefix?: string; // e2e: chat | request-chat
};
const JSON_HEADER = { "Content-Type": "application/json; charset=utf-8" } as const;
const AUTH_REQUIRED_MESSAGE = "Tu sesion expiro. Vuelve a iniciar sesion.";
function normalizeStatus(value?: string | null): string {
  if (!value) return "sent";
  return value;
}
function mapHistoryRow(raw: unknown): Msg | null {
  const row = raw as {
    id?: unknown;
    sender_id?: unknown;
    body?: unknown;
    text?: unknown;
    created_at?: unknown;
    read_by?: unknown;
    message_type?: unknown;
    payload?: unknown;
    attachments?: unknown;
  };
  if (!row?.id) return null;
  const id = String(row.id);
  const senderId = row.sender_id ? String(row.sender_id) : "";
  const createdAt = row.created_at ? String(row.created_at) : new Date().toISOString();
  const bodySource = (row.body ?? row.text ?? "") as unknown;
  const body = typeof bodySource === "string" ? bodySource : String(bodySource ?? "");
  const readBy = Array.isArray(row.read_by)
    ? (row.read_by as unknown[]).map((value) => String(value))
    : [];
  const messageType = row.message_type ? String(row.message_type) : 'text';
  let payload: Record<string, unknown> | null = null;
  if (row.payload) {
    if (typeof row.payload === 'string' && row.payload.trim().length) {
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        payload = null;
      }
    } else if (typeof row.payload === 'object') {
      payload = row.payload as Record<string, unknown>;
    }
  }
  const attachments = Array.isArray(row.attachments)
    ? (row.attachments as Array<Record<string, unknown>>).map((a) => ({
        id: typeof a.id === 'string' ? a.id : undefined,
        filename: String(a.filename ?? ''),
        mime_type: String(a.mime_type ?? ''),
        byte_size: typeof a.byte_size === 'number' ? a.byte_size : (a.byte_size != null ? Number(a.byte_size) : null),
        width: typeof a.width === 'number' ? a.width : (a.width != null ? Number(a.width) : null),
        height: typeof a.height === 'number' ? a.height : (a.height != null ? Number(a.height) : null),
        storage_path: String(a.storage_path ?? ''),
        created_at: typeof a.created_at === 'string' ? a.created_at : undefined,
      }))
    : [];
  return { id, senderId, body, createdAt, readBy, messageType, payload, attachments };
}
async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
export default function ChatPanel({
  conversationId,
  onClose,
  mode = "panel",
  userId,
  requestId: requestIdProp,
  requestBudget: requestBudgetProp,
  dataPrefix = "chat",
}: ChatPanelProps): JSX.Element {
  const supabaseAuth = createClientComponentClient();
  const [open, setOpen] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [messagesState, rawSetMessages] = React.useState<Msg[]>([]);
  const messagesRef = React.useRef<Msg[]>([]);
  const setMessages = React.useCallback(
    (next: Msg[] | ((prev: Msg[]) => Msg[])) => {
      rawSetMessages((prev) => {
        const value = typeof next === "function" ? (next as (p: Msg[]) => Msg[])(prev) : next;
        messagesRef.current = value;
        return value;
      });
    },
    [],
  );
  const [meId, setMeId] = React.useState<string | null>(userId ?? null);
  const [participants, setParticipants] = React.useState<Participants | null>(null);
  const [requestId, setRequestId] = React.useState<string | null>(requestIdProp ?? null);
  const [budget, setBudget] = React.useState<number | null>(
    typeof requestBudgetProp === "number" && Number.isFinite(requestBudgetProp)
      ? requestBudgetProp
      : null,
  );
  const [requiredAt, setRequiredAt] = React.useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectExtra, setRejectExtra] = React.useState("");
  const [offerDialogOpen, setOfferDialogOpen] = React.useState(false);
  const [offerTitle, setOfferTitle] = React.useState("");
  const [offerDescription, setOfferDescription] = React.useState("");
  const [offerAmount, setOfferAmount] = React.useState("");
  const [offerCurrency, setOfferCurrency] = React.useState("MXN");
  const [offerServiceDate, setOfferServiceDate] = React.useState("");
  const [offerScheduleRange, setOfferScheduleRange] = React.useState<[number, number]>([9, 17]);
  const [offerFlexibleSchedule, setOfferFlexibleSchedule] = React.useState(true);
  const [offerSubmitting, setOfferSubmitting] = React.useState(false);
  const [acceptingOfferId, setAcceptingOfferId] = React.useState<string | null>(null);
  const [rejectingOfferId, setRejectingOfferId] = React.useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<string | null>(null);
  void budget;
  void rejectingOfferId;
  void rejectOpen;
  void rejectReason;
  void rejectExtra;
  void rejectTarget;
  const [otherTyping, setOtherTyping] = React.useState(false);
  const channelRef = React.useRef<ReturnType<typeof supabaseBrowser.channel> | null>(null);
  const lastTypingSentRef = React.useRef(0);
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedTokenRef = React.useRef<string | null>(null);
  const syncInFlightRef = React.useRef(false);
  // Date helpers (avoid TZ off-by-one issues)
  const toYMD = React.useCallback((d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);
  const fromYMD = React.useCallback((s: string): Date | null => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(y, mo - 1, d);
  }, []);

  function formatHour(h: number): string {
    const hr = Math.max(0, Math.min(24, Math.floor(h)));
    const base = hr % 24;
    const am = base < 12;
    let display = base % 12;
    if (display === 0) display = 12;
    return `${display}:00 ${am ? "a.m." : "p.m."}`;
  }

  const mergeMessages = React.useCallback(
    (incoming: Msg | Msg[], options: { replace?: boolean; fromServer?: boolean } = {}) => {
      const arr = Array.isArray(incoming) ? incoming : [incoming];
      setMessages((prev) => {
        if (options.replace && arr.length === 0) {
          return prev;
        }
        let base = options.replace ? prev.filter((m) => m.id.startsWith("tmp_")) : [...prev];
        if (options.fromServer && meId) {
          base = base.filter((m) => {
            if (!m.id.startsWith("tmp_")) return true;
            if (m.senderId !== "me") return true;
            const trimmed = m.body.trim();
            return !arr.some((msg) => msg.senderId === meId && msg.body.trim() === trimmed);
          });
        }
        const map = new Map<string, Msg>();
        for (const item of base) map.set(item.id, item);
        for (const msg of arr) map.set(msg.id, msg);
        return Array.from(map.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    },
    [meId, setMessages],
  );

  function getOfferStatusFromMessages(offerId: string): string | null {
    const arr = messagesRef.current || [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const m = arr[i];
      const p = m?.payload as Record<string, unknown> | null;
      if (!p || typeof p !== "object") continue;
      const oid = (p as Record<string, unknown>)["offer_id"];
      if (typeof oid !== "string" || oid !== offerId) continue;
      const stRaw = (p as Record<string, unknown>)["status"];
      const st = typeof stRaw === "string" ? stRaw : null;
      if (st) return st;
    }
    return null;
  }
  // Display formatting not needed when using native date input

  // Custom input not needed with Popover calendar
  const removeMessageById = React.useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },
    [setMessages],
  );
  const handleOpenReject = React.useCallback((offerId: string) => {
    setRejectTarget(offerId);
    setRejectReason("");
    setRejectExtra("");
    setRejectOpen(true);
  }, []);
  const getAuthHeaders = React.useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      const headers: Record<string, string> = { ...JSON_HEADER };
      const isProd = process.env.NODE_ENV === "production";
      const ensureSession = async (force?: boolean): Promise<Session | null> => {
        if (force) {
          const { data, error } = await supabaseAuth.auth.refreshSession();
          if (error) throw error;
          return data?.session ?? null;
        }
        const { data, error } = await supabaseAuth.auth.getSession();
        if (error) throw error;
        if (data?.session) return data.session;
        const refreshed = await supabaseAuth.auth.refreshSession();
        if (refreshed.error) throw refreshed.error;
        return refreshed.data?.session ?? null;
      };
      let session: Session | null = null;
      try {
        session = await ensureSession(options?.forceRefresh);
      } catch (error) {
        if (meId && !isProd) {
          headers["x-user-id"] = meId;
        }
        throw error instanceof Error ? error : new Error(String(error));
      }
      if (!session) {
        if (!meId || isProd) {
          throw new Error("AUTH_REQUIRED");
        }
      } else if (session.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
        headers["x-access-token"] = session.access_token;
        if (session.refresh_token && lastSyncedTokenRef.current !== session.access_token && !syncInFlightRef.current) {
          syncInFlightRef.current = true;
          try {
            await fetch("/api/auth/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json; charset=utf-8" },
              credentials: "include",
              body: JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              }),
            });
          } catch {
            /* ignore sync errors */
          } finally {
            lastSyncedTokenRef.current = session.access_token;
            syncInFlightRef.current = false;
          }
        }
      }
      if (meId) headers["x-user-id"] = meId;
      return headers;
    },
    [supabaseAuth, meId],
  );
  React.useEffect(() => {
    if (meId) return;
    (async () => {
      try {
        const { data } = await supabaseAuth.auth.getUser();
        if (data?.user?.id) setMeId(data.user.id);
      } catch {
        /* ignore */
      }
    })();
  }, [supabaseAuth, meId]);
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await parseJsonSafe<{ user?: { id?: string } }>(res);
        if (res.ok && data?.user?.id) setMeId(data.user.id);
      } catch {
        /* ignore */
      }
    })();
  }, [userId]);
  // Request meta
  const [requestTitle, setRequestTitle] = React.useState<string | null>(null);
  const load = React.useCallback(
    async (withSpinner = true) => {
      if (!conversationId) return;
      if (withSpinner) setLoading(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `/api/chat/history?conversationId=${encodeURIComponent(conversationId)}&limit=200`,
          {
            headers,
            cache: "no-store",
            credentials: "include",
          },
        );
        const data = (await parseJsonSafe<HistoryResponse>(res)) ?? {};
        if (!res.ok) {
          toast.error(data?.error || "No se pudo cargar el historial");
          return;
        }
        const mapped = Array.isArray(data?.data)
          ? (data?.data ?? []).map(mapHistoryRow).filter(Boolean) as Msg[]
          : [];
        mergeMessages(mapped, { replace: true, fromServer: true });
        if (data?.participants) setParticipants(data.participants);
        if (data?.request_id) setRequestId(data.request_id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error de red";
        toast.error(message);
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [conversationId, getAuthHeaders, mergeMessages],
  );
  React.useEffect(() => {
    void load();
  }, [load]);
  React.useEffect(() => {
    if (typeof requestBudgetProp === "number" && Number.isFinite(requestBudgetProp)) {
      setBudget(requestBudgetProp);
    }
  }, [requestBudgetProp]);
  React.useEffect(() => {
    if (requestIdProp && requestIdProp !== requestId) setRequestId(requestIdProp);
  }, [requestIdProp, requestId]);
  React.useEffect(() => {
    if (!offerDialogOpen) return;
    // Prefill title from request when opening the dialog
    if (requestTitle && requestTitle.trim().length) {
      setOfferTitle(requestTitle);
    }
    if (!offerAmount && typeof budget === "number" && Number.isFinite(budget)) {
      setOfferAmount(String(budget));
    }
    if (!offerServiceDate && requiredAt) {
      // requiredAt already comes as YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(requiredAt)) setOfferServiceDate(requiredAt);
      else {
        const parsed = new Date(requiredAt);
        if (!Number.isNaN(parsed.getTime())) setOfferServiceDate(toYMD(parsed));
      }
    }
  }, [offerDialogOpen, budget, requiredAt, offerAmount, offerServiceDate, requestTitle, toYMD]);
  React.useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/requests/${requestId}`, {
          headers,
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const json = await parseJsonSafe<{ data?: Record<string, unknown> }>(res);
        const data = json?.data ?? {};
        const budgetValue = Number((data?.budget as unknown) ?? NaN);
        if (!cancelled && Number.isFinite(budgetValue)) setBudget(budgetValue);
        const reqAt = typeof data?.required_at === "string" ? (data.required_at as string) : null;
        if (!cancelled) setRequiredAt(reqAt);
        const reqTitle = typeof data?.title === "string" ? (data.title as string) : null;
        if (!cancelled) setRequestTitle(reqTitle);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, getAuthHeaders]);
  React.useEffect(() => {
    if (!conversationId) return;
    const channel = supabaseBrowser
      .channel(`messages:${conversationId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        try {
          const from = (payload as any)?.payload?.from as string | undefined;
          if (from && from !== meId) {
            setOtherTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
          }
        } catch {
          /* ignore */
        }
      })
      .on("broadcast", { event: "offer-accepted" }, async (eventPayload) => {
        try {
          const p = (eventPayload as any)?.payload as { from?: string; offer_id?: string; checkout_url?: string | null } | undefined;
          const from = p?.from || null;
          const oid = (p?.offer_id || "").toString();
          const checkoutUrl = typeof p?.checkout_url === "string" ? p?.checkout_url : null;
          if (!oid) return;
          // Ignora eventos que emitimos nosotros mismos
          if (from && meId && from === meId) return;
          const createdAtIso = new Date().toISOString();
          const optimistic: Msg = {
            id: `tmp_b_${oid}`,
            senderId: from || "system",
            body: "Oferta aceptada",
            createdAt: createdAtIso,
            messageType: "system",
            payload: checkoutUrl ? { offer_id: oid, status: "accepted", checkout_url: checkoutUrl } : { offer_id: oid, status: "accepted" },
          };
          mergeMessages(optimistic, { fromServer: true });
        } catch {
          /* ignore */
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabaseBrowser.removeChannel(channel);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [conversationId, mergeMessages, meId]);

  // Hook: realtime messages + attachments
  useChatRealtime(conversationId, {
    onMessageInsert: (row) => {
      let parsedPayload: Record<string, unknown> | null = null;
      const rawPayload = row.payload;
      if (rawPayload) {
        if (typeof rawPayload === "string" && rawPayload.trim().length) {
          try { parsedPayload = JSON.parse(rawPayload) as Record<string, unknown>; } catch { parsedPayload = null; }
        } else if (typeof rawPayload === "object") {
          parsedPayload = rawPayload as Record<string, unknown>;
        }
      }
      const msg: Msg = {
        id: row.id,
        senderId: row.sender_id,
        body: (row.body ?? row.text ?? "").toString(),
        createdAt: row.created_at,
        readBy: Array.isArray(row.read_by) ? (row.read_by as unknown[]).map((v) => String(v)) : [],
        messageType: row.message_type ? String(row.message_type) : "text",
        payload: parsedPayload,
        attachments: [],
      };
      try {
        if (msg.messageType === "system" && msg.payload && typeof msg.payload === "object") {
          const p = msg.payload as Record<string, unknown>;
          const st = typeof p.status === "string" ? p.status : null;
          const oid = typeof p.offer_id === "string" ? p.offer_id : null;
          if (st === "accepted" && oid) removeMessageById(`tmp_b_${oid}`);
        }
      } catch { /* ignore */ }
      mergeMessages(msg, { fromServer: true });
    },
    onAttachmentInsert: (r) => {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug('ui addAttachment <-', r.message_id, r.filename, r.storage_path);
      }
      setMessages((prev) => appendAttachment(prev, r.message_id, {
        id: r.id,
        filename: r.filename,
        mime_type: r.mime_type,
        byte_size: r.byte_size ?? null,
        width: r.width ?? null,
        height: r.height ?? null,
        storage_path: r.storage_path,
        created_at: r.created_at,
      }));
    },
    onAttachmentDelete: (r) => {
      setMessages((prev) => removeAttachment(prev, r.message_id, r.id));
    },
  });
  const viewerRole = React.useMemo(() => {
    if (!participants || !meId) return "guest" as const;
    if (participants?.customer_id === meId) return "customer" as const;
    if (participants.pro_id === meId) return "professional" as const;
    return "guest" as const;
  }, [participants, meId]);
  const offerSummaries = React.useMemo(() => {
    const map = new Map<string, { offerId: string; status: string; checkoutUrl: string | null; title?: string | null; amount?: number | null; currency?: string | null }>();
    for (const msg of messagesState) {
      const payload = msg.payload;
      if (!payload || typeof payload !== "object") continue;
      const rawId = (payload as Record<string, unknown>).offer_id;
      if (typeof rawId !== "string" || !rawId) continue;
      const summary = map.get(rawId) ?? {
        offerId: rawId,
        status: "sent",
        checkoutUrl: null,
        title: null,
        amount: null,
        currency: "MXN",
      };
      if (msg.messageType === "offer") {
        const amountRaw = (payload as Record<string, unknown>).amount;
        const currencyRaw = (payload as Record<string, unknown>).currency;
        const __maybeTitle = (payload as any)?.title;
        if (typeof __maybeTitle === "string") {
          summary.title = __maybeTitle;
        }
        const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw ?? NaN);
        summary.amount = Number.isFinite(amount) ? amount : summary.amount;
        summary.currency = typeof currencyRaw === "string" && currencyRaw.trim().length ? currencyRaw.toUpperCase() : summary.currency;
        summary.status = normalizeStatus((payload as Record<string, unknown>).status as string | undefined);
        const checkoutUrlRaw = (payload as Record<string, unknown>).checkout_url;
        summary.checkoutUrl = typeof checkoutUrlRaw === "string" ? checkoutUrlRaw : summary.checkoutUrl;
      } else if (msg.messageType === "system") {
        const statusRaw = (payload as Record<string, unknown>).status;
        if (typeof statusRaw === "string") summary.status = normalizeStatus(statusRaw);
        const checkoutUrlRaw = (payload as Record<string, unknown>).checkout_url;
        if (typeof checkoutUrlRaw === "string") summary.checkoutUrl = checkoutUrlRaw;
      }
      map.set(rawId, summary);
    }
    return map;
  }, [messagesState]);
  const otherUserId = React.useMemo(() => {
    if (!participants || !meId) return undefined;
    return participants?.customer_id === meId ? participants.pro_id : participants?.customer_id;
  }, [participants, meId]);
  void otherUserId;
  async function postMessage(body: string, attempt = 0): Promise<{ ok: true; id: string | null; createdAt: string; body: string; payload: Record<string, unknown> | null } | { ok: false; error: string }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/chat/send`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ conversationId, body }),
      });
      const json = await parseJsonSafe<{
        ok?: boolean;
        error?: string;
        message?: string;
        data?: { id?: string; created_at?: string; body?: unknown; payload?: unknown };
      }>(res);
      const errorText = json?.error || json?.message || "";
      const authProblem =
        res.status === 401 ||
        errorText === "MISSING_AUTH" ||
        errorText === "INVALID_TOKEN" ||
        /auth session missing/i.test(errorText);
      if (authProblem) {
        if (attempt === 0) {
          lastSyncedTokenRef.current = null;
          return postMessage(body, attempt + 1);
        }
        return { ok: false, error: AUTH_REQUIRED_MESSAGE };
      }
      if (res.status === 422) {
        const message = json?.message || json?.error || getContactPolicyMessage();
        return { ok: false, error: message };
      }
      if (!res.ok || json?.ok === false) {
        const message = json?.message || json?.error || "No se pudo enviar el mensaje";
        if (attempt === 0 && /auth session missing/i.test(message)) {
          lastSyncedTokenRef.current = null;
          return postMessage(body, attempt + 1);
        }
        return { ok: false, error: message };
      }
      const id = json?.data?.id ? String(json.data.id) : null;
      const createdAt = json?.data?.created_at ? String(json.data.created_at) : new Date().toISOString();
      let messageBody = body;
      const rawBody = json?.data?.body;
      if (typeof rawBody === "string") {
        messageBody = rawBody;
      } else if (rawBody != null) {
        messageBody = String(rawBody);
      }
      let payload: Record<string, unknown> | null = null;
      const rawPayload = json?.data?.payload;
      if (typeof rawPayload === "string") {
        try {
          payload = JSON.parse(rawPayload) as Record<string, unknown>;
        } catch {
          payload = null;
        }
      } else if (rawPayload && typeof rawPayload === "object") {
        payload = rawPayload as Record<string, unknown>;
      }
      return { ok: true, id, createdAt, body: messageBody, payload };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de red";
      if (attempt === 0 && /auth session missing/i.test(message)) {
        lastSyncedTokenRef.current = null;
        return postMessage(body, attempt + 1);
      }
      if (
        /auth session missing/i.test(message) ||
        message === "AUTH_REQUIRED" ||
        /invalid_token/i.test(message) ||
        message === "MISSING_AUTH"
      ) {
        return { ok: false, error: AUTH_REQUIRED_MESSAGE };
      }
      return { ok: false, error: message };
    }
  }
  async function _sendApiMessage(text: string) {
    const optimistic: Msg = {
      id: `tmp_${Date.now()}`,
      senderId: "me",
      body: text,
      createdAt: new Date().toISOString(),
      messageType: "text",
      payload: null,
    };
    mergeMessages(optimistic);
    const result = await postMessage(text);
    if (!result.ok) {
      removeMessageById(optimistic.id);
      toast.error(result.error);
      return false;
    }
    if (result.id) {
      const serverMsg: Msg = {
        id: result.id,
        senderId: meId ?? "me",
        body: text,
        createdAt: result.createdAt,
        messageType: "text",
        payload: null,
      };
      mergeMessages(serverMsg, { fromServer: true });
    }
    return true;
  }
  async function submitOffer() {
    if (viewerRole !== "customer") {
      toast.error("Solo el cliente puede crear ofertas");
      return;
    }
    const title = offerTitle.trim();
    if (!title) {
      toast.error("Ingresa un titulo para la oferta");
      return;
    }
    const amountValue = Number(offerAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Monto invalido");
      return;
    }
    setOfferSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const payload: Record<string, unknown> = {
        title,
        amount: Math.round((amountValue + Number.EPSILON) * 100) / 100,
        currency: offerCurrency.trim().toUpperCase() || "MXN",
      };
      const userDesc = offerDescription.trim();
      let scheduleNote = "";
      let flexibleNote = "";
      if (!offerFlexibleSchedule && Array.isArray(offerScheduleRange) && offerScheduleRange.length >= 2) {
        const a = Math.max(0, Math.min(24, Math.floor(offerScheduleRange[0] ?? 0)));
        const b = Math.max(0, Math.min(24, Math.floor(offerScheduleRange[1] ?? 0)));
        const sh = Math.min(a, b);
        const eh = Math.max(a, b);
        scheduleNote = sh === eh ? `Horario: ${formatHour(sh)}` : `Horario: ${formatHour(sh)} — ${formatHour(eh)}`;
      }
      else if (offerFlexibleSchedule) {
        flexibleNote = "Horario flexible";
      }
      const finalDescription = [userDesc, flexibleNote, scheduleNote].filter(Boolean).join("\n");
      if (finalDescription) payload.description = finalDescription;
      if (offerServiceDate) {
        const d = fromYMD(offerServiceDate) ?? new Date(offerServiceDate);
        if (!Number.isNaN(d.getTime())) {
          // Normalize to start-of-day local, then to ISO
          const localStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          payload.serviceDate = localStart.toISOString();
        }
      }
      // horario
      payload.flexibleSchedule = offerFlexibleSchedule;
      if (!offerFlexibleSchedule && Array.isArray(offerScheduleRange) && offerScheduleRange.length >= 2) {
        const a = Math.max(0, Math.min(24, Math.floor(offerScheduleRange[0] ?? 0)));
        const b = Math.max(0, Math.min(24, Math.floor(offerScheduleRange[1] ?? 0)));
        payload.scheduleStartHour = Math.min(a, b);
        payload.scheduleEndHour = Math.max(a, b);
      }
      const res = await fetch(`/api/conversations/${conversationId}/offers`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await parseJsonSafe<{ ok?: boolean; error?: string; offer?: Record<string, unknown> }>(res);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "No se pudo crear la oferta");
      }

      // Optimistic offer message so it appears immediately
      try {
        const createdAtIso = new Date().toISOString();
        const offerId = String((json?.offer as Record<string, unknown> | undefined)?.id || `tmp_offer_${Date.now()}`);
        const payloadMsg: Record<string, unknown> = {
          offer_id: offerId,
          title,
          amount: Number(amountValue.toFixed(2)),
          currency: (offerCurrency || "MXN").toUpperCase(),
          status: "sent",
        };
        if (finalDescription) payloadMsg.description = finalDescription;
        if (typeof (payload as Record<string, unknown>).serviceDate === "string") {
          payloadMsg.service_date = (payload as Record<string, string>).serviceDate;
        }
        const optimisticOffer: Msg = {
          id: `tmp_${Date.now()}`,
          senderId: meId ?? "me",
          body: title,
          createdAt: createdAtIso,
          messageType: "offer",
          payload: payloadMsg,
        };
        mergeMessages(optimisticOffer);
      } catch {
        /* no-op optimistic */
      }
      toast.success("Oferta enviada");
      setOfferDialogOpen(false);
      setOfferTitle("");
      setOfferDescription("");
      setOfferAmount("");
      setOfferServiceDate("");
      await load(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      toast.error(message);
    } finally {
      setOfferSubmitting(false);
    }
  }
  async function handleAcceptOffer(offerId: string, attempt = 0): Promise<void> {
    if (viewerRole !== "professional") {
      toast.error("Solo el profesional puede aceptar la oferta");
      return;
    }
    const summary = offerSummaries.get(offerId);
    if (!summary || normalizeStatus(summary.status) !== "sent") {
      toast.error("La oferta ya no esta disponible");
      return;
    }
    setAcceptingOfferId(offerId);
    try {
      // Intento 1: PostgREST directo (rapido, condicionado a sent) usando token del usuario
      try {
        const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        const headers = await getAuthHeaders();
        const hasBearer = typeof (headers as any).Authorization === "string" && (headers as any).Authorization.startsWith("Bearer ");
        if (supaUrl && anonKey && hasBearer) {
          const restUrl = `${supaUrl.replace(/\/$/, "")}/rest/v1/offers?id=eq.${encodeURIComponent(offerId)}&status=eq.sent&select=id,status,checkout_url`;
          const res = await fetch(restUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              Prefer: "return=representation",
              apikey: anonKey,
              Authorization: (headers as any).Authorization as string,
            },
            body: JSON.stringify({ status: "accepted" }),
          });
          if (res.ok) {
            let rows: unknown = null;
            try { rows = await res.json(); } catch { rows = []; }
            const arr = Array.isArray(rows) ? (rows as Array<{ id?: string; status?: string; checkout_url?: string | null }>) : [];
            if (arr.length > 0 && String(arr[0]?.status || "").toLowerCase() === "accepted") {
              // Optimistic system message so client sees Pay now immediately
              try {
                const createdAtIso = new Date().toISOString();
                const payload: Record<string, unknown> = { offer_id: offerId, status: "accepted" };
                if (typeof arr[0]?.checkout_url === "string") payload.checkout_url = arr[0]!.checkout_url;
                mergeMessages(
                  { id: `tmp_${Date.now()}`, senderId: meId ?? "me", body: "Oferta aceptada", createdAt: createdAtIso, messageType: "system", payload },
                  { fromServer: true },
                );
                // Broadcast para el otro participante (mostrar Pay ahora al instante)
                try {
                  if (channelRef.current) {
                    void channelRef.current.send({
                      type: "broadcast",
                      event: "offer-accepted",
                      payload: { from: meId || "me", offer_id: offerId, checkout_url: (arr[0]?.checkout_url as string | null) ?? null },
                    });
                  }
                } catch {
                  /* ignore */
                }
              } catch { /* ignore optimistic */ }
              toast.success("Oferta aceptada");
              await load(false);
              return;
            }
          }
        }
      } catch { /* fallback to server routes */ }

      const headers = await getAuthHeaders();
      // Aceptación por conversación (servidor)
      const res = await fetch(`/api/conversations/${conversationId}/offers/accept`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ conversationId }),
      });
      const json = await parseJsonSafe<{ ok?: boolean; error?: string; checkoutUrl?: string }>(res);
      if (res.ok && json?.ok !== false) {
        toast.success("Oferta aceptada");
        // Optimistic system message to immediately show accepted state (and Pay now for client)
        try {
          const createdAtIso = new Date().toISOString();
          const payload: Record<string, unknown> = { offer_id: offerId, status: "accepted" };
          if (json?.checkoutUrl) payload.checkout_url = json.checkoutUrl;
          mergeMessages(
            {
              id: `tmp_${Date.now()}`,
              senderId: meId ?? "me",
              body: "Oferta aceptada",
              createdAt: createdAtIso,
              messageType: "system",
              payload,
            },
            { fromServer: true },
          );
          // Broadcast para el otro participante
          try {
            if (channelRef.current) {
              void channelRef.current.send({
                type: "broadcast",
                event: "offer-accepted",
                payload: { from: meId || "me", offer_id: offerId, checkout_url: json?.checkoutUrl ?? null },
              });
            }
          } catch {
            /* ignore */
          }
        } catch { /* no-op optimistic */ }
        await load(false);
        return;
      }
      // Fallback por id
      const res2 = await fetch(`/api/offers/${offerId}/accept`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ conversationId }),
      });
      const json2 = await parseJsonSafe<{ ok?: boolean; error?: string; checkoutUrl?: string }>(res2);
      if (res2.ok && json2?.ok !== false) {
        toast.success("Oferta aceptada");
        // Optimistic system message to immediately show accepted state (and Pay now for client)
        try {
          const createdAtIso = new Date().toISOString();
          const payload: Record<string, unknown> = { offer_id: offerId, status: "accepted" };
          if (json2?.checkoutUrl) payload.checkout_url = json2.checkoutUrl;
          mergeMessages(
            {
              id: `tmp_${Date.now()}`,
              senderId: meId ?? "me",
              body: "Oferta aceptada",
              createdAt: createdAtIso,
              messageType: "system",
              payload,
            },
            { fromServer: true },
          );
          // Broadcast para el otro participante
          try {
            if (channelRef.current) {
              void channelRef.current.send({
                type: "broadcast",
                event: "offer-accepted",
                payload: { from: meId || "me", offer_id: offerId, checkout_url: json2?.checkoutUrl ?? null },
              });
            }
          } catch {
            /* ignore */
          }
        } catch { /* no-op optimistic */ }
        await load(false);
        return;
      }
      if ((res.status === 404 || res2.status === 404) && attempt === 0) {
        await load(false);
        const nextId = findLatestSentOfferId();
        if (nextId && nextId !== offerId) {
          await handleAcceptOffer(nextId, attempt + 1);
          return;
        }
      }
      const errText = ((json?.error || json2?.error || "").toString() || "").toUpperCase();
      if ((res.status === 409 || res2.status === 409) || errText.includes("LOCKED") || errText.includes("INVALID_STATUS")) {
        toast.message?.("Procesando oferta…", { description: "Sincronizando estado" });
        for (let i = 0; i < 8; i++) {
          await new Promise((r) => setTimeout(r, 600));
          await load(false);
          const st = normalizeStatus(getOfferStatusFromMessages(offerId));
          if (st === "accepted") {
            toast.success("Oferta aceptada");
            return;
          }
          if (st !== "sent") {
            toast.error("La oferta ya no está disponible");
            return;
          }
        }
        throw new Error("No se pudo aceptar la oferta. Intenta de nuevo.");
      }
      throw new Error(json?.error || json2?.error || "No se pudo aceptar la oferta");
    } catch (error) {
      const message = (error instanceof Error ? error.message : "Error").toString();
      if (/LOCKED/i.test(message) || /INVALID_STATUS/i.test(message)) {
        toast.error("No se pudo aceptar la oferta. Intenta de nuevo.");
      } else {
        toast.error(message);
      }
    } finally {
      setAcceptingOfferId(null);
    }
  }
  function findLatestSentOfferId(): string | null {
    const arr = messagesRef.current || [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const m = arr[i];
      const p = m?.payload as Record<string, unknown> | null;
      if (!p || typeof p !== "object") continue;
      const oid = (p as Record<string, unknown>)["offer_id"];
      const status = (p as Record<string, unknown>)["status"];
      if (typeof oid === "string" && typeof status === "string" && normalizeStatus(status) === "sent") {
        return oid;
      }
    }
    return null;
  }
  async function _submitRejectOffer(): Promise<void> {
    if (!rejectTarget) {
      setRejectOpen(false);
      return;
    }
    if (viewerRole !== "professional") {
      toast.error("Solo el profesional puede rechazar la oferta");
      return;
    }
    if (!rejectReason) {
      toast.error("Selecciona un motivo");
      return;
    }
    const current = offerSummaries.get(rejectTarget);
    if (!current || normalizeStatus(current.status) !== "sent") {
      toast.error("La oferta ya no esta disponible");
      setRejectOpen(false);
      return;
    }
    const extra = rejectExtra.trim();
    const reasonPayload = extra ? `${rejectReason} - ${extra}` : rejectReason;
    setRejectingOfferId(rejectTarget);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/offers/${rejectTarget}/reject`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ reason: reasonPayload }),
      });
      const json = await parseJsonSafe<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "No se pudo rechazar la oferta");
      }
      toast.success("Oferta rechazada");
      setRejectOpen(false);
      setRejectReason("");
      setRejectExtra("");
      setRejectTarget(null);
      await load(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      toast.error(message);
    } finally {
      setRejectingOfferId(null);
    }
  }
  const emitTyping = React.useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1200) return;
    lastTypingSentRef.current = now;
    try {
      if (!channelRef.current) return;
      void channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { from: meId || "me" },
      });
    } catch {
      /* ignore */
    }
  }, [meId]);
  async function onSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const optimistic: Msg = {
      id: `tmp_${Date.now()}`,
      senderId: "me",
      body: trimmed,
      createdAt: new Date().toISOString(),
      messageType: "text",
      payload: null,
    };
    mergeMessages(optimistic);
    const result = await postMessage(trimmed);
    if (!result.ok) {
      removeMessageById(optimistic.id);
      toast.error(result.error);
      return false;
    }
    removeMessageById(optimistic.id);
    const messageId = result.id ?? optimistic.id;
    mergeMessages(
      {
        id: messageId,
        senderId: meId ?? "me",
        body: result.body,
        createdAt: result.createdAt,
        messageType: "text",
        payload: result.payload ?? null,
      },
      { fromServer: true },
    );
    return true;
  }
  const loadingState = loading ? (
    <div className="flex-1 p-3 text-sm text-slate-500" role="status" aria-busy>
      Cargando...
    </div>
  ) : null;
  const actionButtons = (
    <>
      {participants && meId === participants?.customer_id ? (
        <div className="p-3 flex items-center justify-end">
          <Button
            onClick={() => {
              // Ensure title is prefilled on click
              if (requestTitle && requestTitle.trim().length) setOfferTitle(requestTitle);
              setOfferDialogOpen(true);
            }}
          >
            Contratar
          </Button>
        </div>
      ) : null}
    </>
  );
  const typingIndicator = otherTyping ? <TypingIndicator /> : null;
  const messageList = (
    <MessageList
      items={messagesState}
      currentUserId={meId ?? undefined}
      viewerRole={viewerRole}
      onAcceptOffer={handleAcceptOffer}
      onRejectOffer={handleOpenReject}
      actionOfferId={acceptingOfferId ?? rejectingOfferId}
      dataPrefix={dataPrefix}
    />
  );
  const offerDialog = (
    <Dialog
      open={offerDialogOpen}
      onOpenChange={(value) => {
        setOfferDialogOpen(value);
        if (!value) {
          setOfferTitle("");
          setOfferDescription("");
          setOfferAmount("");
          setOfferCurrency("MXN");
          setOfferServiceDate("");
          setOfferScheduleRange([9, 17]);
          setOfferFlexibleSchedule(true);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear oferta</DialogTitle>
          <DialogDescription>Define el monto y los detalles antes de enviar la oferta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Titulo</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm bg-neutral-100 text-neutral-700 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-300"
              value={offerTitle}
              onChange={(event) => setOfferTitle(event.target.value)}
              readOnly
              disabled
              placeholder="Instalacion de lamparas"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Monto</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2 text-sm"
                value={offerAmount}
                onChange={(event) => setOfferAmount(event.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Moneda</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm bg-neutral-100 text-neutral-700 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-300"
                value={offerCurrency}
                onChange={(event) => setOfferCurrency(event.target.value.toUpperCase())}
                readOnly
                disabled
                maxLength={6}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Fecha objetivo</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 text-sm"
              value={offerServiceDate}
              onChange={(event) => setOfferServiceDate(event.target.value)}
              min={toYMD(new Date())}
            />
          </div>
          <div className="space-y-2">
            <label
              className={`inline-flex items-center gap-2 text-sm font-medium text-slate-700 ${
                offerFlexibleSchedule ? "opacity-100" : "opacity-60"
              }`}
            >
              <input
                type="checkbox"
                className="size-4"
                checked={offerFlexibleSchedule}
                onChange={(e) => setOfferFlexibleSchedule(e.target.checked)}
              />
              Horario flexible
            </label>
            {!offerFlexibleSchedule ? (
              <div className="px-1">
                <div className="text-xs text-muted-foreground mb-2">Seleccionar horario.</div>
                <Slider
                  min={0}
                  max={24}
                  step={1}
                  minStepsBetweenThumbs={0}
                  value={offerScheduleRange}
                  onValueChange={(vals) => {
                    if (Array.isArray(vals) && vals.length >= 2) {
                      const a = Math.max(0, Math.min(24, Math.floor(vals[0] ?? 0)));
                      const b = Math.max(0, Math.min(24, Math.floor(vals[1] ?? 0)));
                      setOfferScheduleRange(a <= b ? [a, b] : [b, a]);
                    }
                  }}
                />
                <div className="mt-1 text-xs text-muted-foreground">
                  {offerScheduleRange[0] === offerScheduleRange[1]
                    ? formatHour(offerScheduleRange[0])
                    : `${formatHour(offerScheduleRange[0])} — ${formatHour(offerScheduleRange[1])}`}
                </div>
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Descripcion</label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              rows={3}
              value={offerDescription}
              onChange={(event) => setOfferDescription(event.target.value)}
              placeholder="Incluye detalles relevantes para la oferta"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOfferDialogOpen(false)} disabled={offerSubmitting}>
            Cancelar
          </Button>
          <Button onClick={submitOffer} disabled={offerSubmitting}>
            {offerSubmitting ? "Enviando..." : "Enviar oferta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const dialog = (
    <Dialog
      open={rejectOpen}
      onOpenChange={(value) => {
        setRejectOpen(value);
        if (!value) {
          setRejectReason("");
          setRejectExtra("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar oferta</DialogTitle>
          <DialogDescription>
            Estas seguro de rechazar este trabajo? Si es asi notifica al cliente tus requerimientos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Motivo</label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            >
              <option value="">Selecciona...</option>
              <option>El presupuesto es muy bajo</option>
              <option>No estoy disponible esa fecha</option>
              <option>Necesito mas informacion</option>
              <option>Otro</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Detalle (opcional)</label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm"
              rows={3}
              value={rejectExtra}
              onChange={(event) => setRejectExtra(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setRejectOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void _submitRejectOffer()}
            disabled={!rejectReason}
          >
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  if (mode === "page") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b p-3">
          <div className="text-xs text-muted-foreground">Evita compartir datos personales</div>
        </div>
        {loadingState || messageList}
        {typingIndicator}
        {actionButtons}
        <div className="border-t p-2">
          <ChatUploader
            conversationId={conversationId}
            mode="draft-first"
            onMessageCreated={({ messageId, attachments }) => {
              if (process.env.NODE_ENV !== "production") {
                // eslint-disable-next-line no-console
                console.debug("ui att add optimistic", messageId, attachments.length);
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        attachments: [
                          ...(Array.isArray(m.attachments) ? m.attachments : []),
                          ...attachments.map((a) => ({
                            id: undefined,
                            filename: a.filename,
                            mime_type: a.mime_type,
                            byte_size: a.byte_size,
                            width: a.width ?? null,
                            height: a.height ?? null,
                            storage_path: a.storage_path,
                          })),
                        ],
                      }
                    : m,
                ),
              );
            }}
          />
        </div>
        <MessageInput onSend={onSend} onTyping={emitTyping} autoFocus disabled={loading} dataPrefix={dataPrefix} />
        {offerDialog}
        {dialog}
      </div>
    );
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) onClose();
      }}
    >
      <SheetContent side="right" className="sm:max-w-md p-0" data-testid={`${dataPrefix}-box`}>
        <SheetHeader className="sr-only">
          <SheetTitle>Chat</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col">
          <div className="border-b p-3">
            <div className="text-xs text-muted-foreground">Evita compartir datos personales</div>
          </div>
          {loadingState || (
            <>
              {messageList}
              {typingIndicator}
              {actionButtons}
            </>
          )}
          <div className="border-t p-2">
            <ChatUploader
              conversationId={conversationId}
              mode="draft-first"
              onMessageCreated={({ messageId, attachments }) => {
                if (process.env.NODE_ENV !== "production") {
                  // eslint-disable-next-line no-console
                  console.debug("ui att add optimistic", messageId, attachments.length);
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId
                      ? {
                          ...m,
                          attachments: [
                            ...(Array.isArray(m.attachments) ? m.attachments : []),
                            ...attachments.map((a) => ({
                              id: undefined,
                              filename: a.filename,
                              mime_type: a.mime_type,
                              byte_size: a.byte_size,
                              width: a.width ?? null,
                              height: a.height ?? null,
                              storage_path: a.storage_path,
                            })),
                          ],
                        }
                      : m,
                  ),
                );
              }}
            />
          </div>
          <MessageInput onSend={onSend} onTyping={emitTyping} autoFocus disabled={loading} dataPrefix={dataPrefix} />
          {offerDialog}
          {dialog}
        </div>
      </SheetContent>
    </Sheet>
  );
}
