/* eslint-disable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CircleHelp, X } from "lucide-react";
import MessageList from "@/components/chat/MessageList";
import QuoteComposerDialog from "@/components/quotes/QuoteComposerDialog";
import MessageInput from "@/components/chat/MessageInput";
import ChatUploader from "@/app/(app)/(app-shell)/messages/_components/ChatUploader";
import {
  getContactPolicyMessage,
  isContactPolicyLifted,
} from "@/lib/safety/policy";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { Button } from "@/components/ui/button";
import { UI_STATUS_LABELS } from "@/lib/request-status";
import OfferPaymentDialog from "@/components/payments/OfferPaymentDialog";
import { Slider } from "@/components/ui/slider";
import { appendAttachment, removeAttachment } from "@/components/chat/utils";
import { useChatRealtime } from "@/app/(app)/(app-shell)/messages/_hooks/useChatRealtime";
import CompanyToggle from "@/components/forms/CompanyToggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AvatarWithSkeleton from "@/components/ui/AvatarWithSkeleton";
import { CHAT_AVATAR_PLACEHOLDER } from "@/lib/chat/chat-identity";
import { resolveChatAvatarSrc } from "@/lib/chat/chat-avatar";
import { normalizeAppError } from "@/lib/errors/app-error";
import { reportError } from "@/lib/errors/report-error";
import FinishJobTrigger from "@/components/services/FinishJobTrigger.client";
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
type OnsiteCtaSummary = {
  id: string;
  status: string;
  remuneration_applied_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};
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
  composerPrefillText?: string | null;
  dataPrefix?: string; // e2e: chat | request-chat
  hideClientCtas?: boolean;
  ignoreStageLock?: boolean;
  stickyActionBar?: boolean;
  openOfferDialogSignal?: number;
  offerPrefillTitle?: string | null;
  offerPrefillAmount?: number | null;
};
const JSON_HEADER = {
  "Content-Type": "application/json; charset=utf-8",
} as const;
const AUTH_REQUIRED_MESSAGE = "Tu sesion expiro. Vuelve a iniciar sesion.";
function getChatFriendlyError(error: unknown, source: string): string {
  const normalized = normalizeAppError(error, { source });
  reportError({
    error,
    normalized,
    area: "messages",
    feature: source,
    route: "chat-panel",
    blocking: false,
  });
  return normalized.userMessage;
}
function normalizeStatus(value?: string | null): string {
  if (!value) return "pending";
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
  const createdAt = row.created_at
    ? String(row.created_at)
    : new Date().toISOString();
  const bodySource = (row.body ?? row.text ?? "") as unknown;
  const body =
    typeof bodySource === "string" ? bodySource : String(bodySource ?? "");
  const readBy = Array.isArray(row.read_by)
    ? (row.read_by as unknown[]).map((value) => String(value))
    : [];
  const messageType = row.message_type ? String(row.message_type) : "text";
  let payload: Record<string, unknown> | null = null;
  if (row.payload) {
    if (typeof row.payload === "string" && row.payload.trim().length) {
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        payload = null;
      }
    } else if (typeof row.payload === "object") {
      payload = row.payload as Record<string, unknown>;
    }
  }
  const attachments = Array.isArray(row.attachments)
    ? (row.attachments as Array<Record<string, unknown>>).map((a) => ({
        id: typeof a.id === "string" ? a.id : undefined,
        filename: String(a.filename ?? ""),
        mime_type: String(a.mime_type ?? ""),
        byte_size:
          typeof a.byte_size === "number"
            ? a.byte_size
            : a.byte_size != null
              ? Number(a.byte_size)
              : null,
        width:
          typeof a.width === "number"
            ? a.width
            : a.width != null
              ? Number(a.width)
              : null,
        height:
          typeof a.height === "number"
            ? a.height
            : a.height != null
              ? Number(a.height)
              : null,
        storage_path: String(a.storage_path ?? ""),
        created_at: typeof a.created_at === "string" ? a.created_at : undefined,
      }))
    : [];
  return {
    id,
    senderId,
    body,
    createdAt,
    readBy,
    messageType,
    payload,
    attachments,
  };
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
  composerPrefillText,
  dataPrefix = "chat",
  hideClientCtas = false,
  ignoreStageLock = false,
  stickyActionBar = false,
  openOfferDialogSignal,
  offerPrefillTitle,
  offerPrefillAmount,
}: ChatPanelProps): JSX.Element {
  const supabaseAuth = createSupabaseBrowser();
  const [open, setOpen] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [messagesState, rawSetMessages] = React.useState<Msg[]>([]);
  const messagesRef = React.useRef<Msg[]>([]);
  const setMessages = React.useCallback(
    (next: Msg[] | ((prev: Msg[]) => Msg[])) => {
      rawSetMessages((prev) => {
        const value =
          typeof next === "function"
            ? (next as (p: Msg[]) => Msg[])(prev)
            : next;
        messagesRef.current = value;
        return value;
      });
    },
    [],
  );
  const [meId, setMeId] = React.useState<string | null>(userId ?? null);
  const [participants, setParticipants] = React.useState<Participants | null>(
    null,
  );
  const [requestId, setRequestId] = React.useState<string | null>(
    requestIdProp ?? null,
  );
  const [requestTitle, setRequestTitle] = React.useState<string | null>(null);
  const [requestStatus, setRequestStatus] = React.useState<string | null>(null);
  const headerProfileIdRef = React.useRef<string | null>(null);
  const [headerProfile, setHeaderProfile] = React.useState<{
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);
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
  const [offerAmountLocked, setOfferAmountLocked] = React.useState(false);
  const [offerCurrency, setOfferCurrency] = React.useState("MXN");
  const [offerServiceDate, setOfferServiceDate] = React.useState("");
  const [offerServiceDateError, setOfferServiceDateError] =
    React.useState(false);
  const [offerScheduleRange, setOfferScheduleRange] = React.useState<
    [number, number]
  >([9, 17]);
  const [offerFlexibleSchedule, setOfferFlexibleSchedule] =
    React.useState(true);
  const [offerSubmitting, setOfferSubmitting] = React.useState(false);
  // Pro: Quote (cotización formal)
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const offerSignalRef = React.useRef<number | undefined>(
    openOfferDialogSignal,
  );
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

  const resolveOfferServiceDate = React.useCallback(() => {
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    let base = todayStart;
    if (requiredAt) {
      let parsed: Date | null = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(requiredAt)) parsed = fromYMD(requiredAt);
      else {
        const tmp = new Date(requiredAt);
        parsed = Number.isNaN(tmp.getTime()) ? null : tmp;
      }
      if (parsed) {
        const parsedStart = new Date(
          parsed.getFullYear(),
          parsed.getMonth(),
          parsed.getDate(),
        );
        base = parsedStart < todayStart ? todayStart : parsedStart;
      }
    }
    return toYMD(base);
  }, [fromYMD, requiredAt, toYMD]);
  React.useEffect(() => {
    if (openOfferDialogSignal === undefined) return;
    if (offerSignalRef.current === openOfferDialogSignal) return;
    offerSignalRef.current = openOfferDialogSignal;
    const title =
      (offerPrefillTitle && offerPrefillTitle.trim()) ||
      (requestTitle && requestTitle.trim()) ||
      "";
    if (title) setOfferTitle(title);
    if (
      typeof offerPrefillAmount === "number" &&
      Number.isFinite(offerPrefillAmount)
    ) {
      setOfferAmount(String(offerPrefillAmount));
      setOfferAmountLocked(false);
    }
    setOfferCurrency("MXN");
    setOfferServiceDate(resolveOfferServiceDate());
    setOfferServiceDateError(false);
    setOfferDialogOpen(true);
  }, [
    offerPrefillAmount,
    offerPrefillTitle,
    openOfferDialogSignal,
    requestTitle,
    resolveOfferServiceDate,
  ]);
  // Pro: Onsite quote request
  const [onsiteOpen, setOnsiteOpen] = React.useState(false);
  const [onsiteAmount, setOnsiteAmount] = React.useState<string>("200");
  const [onsiteDetails, setOnsiteDetails] = React.useState<string>("");
  const [onsiteRemunerable, setOnsiteRemunerable] =
    React.useState<boolean>(false);
  const [onsiteSubmitting, setOnsiteSubmitting] = React.useState(false);
  const [onsiteDbSummary, setOnsiteDbSummary] =
    React.useState<OnsiteCtaSummary | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = React.useState<string | null>(
    null,
  );
  const [rejectingOfferId, setRejectingOfferId] = React.useState<string | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = React.useState<string | null>(null);
  // Show the safety tip every time a chat is opened (per conversation)
  const [showSafetyTip, setShowSafetyTip] = React.useState<boolean>(true);
  React.useEffect(() => {
    setShowSafetyTip(true);
  }, [conversationId]);
  // Smooth fade out for safety tip
  const [safetyClosing, setSafetyClosing] = React.useState(false);
  void budget;
  void rejectingOfferId;
  void rejectOpen;
  void rejectReason;
  void rejectExtra;
  void rejectTarget;
  const [otherTyping, setOtherTyping] = React.useState(false);
  const channelRef = React.useRef<ReturnType<
    typeof supabaseBrowser.channel
  > | null>(null);
  const lastTypingSentRef = React.useRef(0);
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastSyncedTokenRef = React.useRef<string | null>(null);
  const syncInFlightRef = React.useRef(false);
  const lastResyncTokenRef = React.useRef<string | null>(null);
  const resyncInFlightRef = React.useRef(false);
  const resyncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const fallbackPollRef = React.useRef<{
    token: string | null;
    active: boolean;
  }>({ token: null, active: false });
  // Expose uploader API to trigger from MessageInput icons
  const uploaderApiRef = React.useRef<{
    pickFiles: () => void;
    pickCamera: () => void;
  } | null>(null);
  function formatHour(h: number): string {
    const hr = Math.max(0, Math.min(24, Math.floor(h)));
    const base = hr % 24;
    const am = base < 12;
    let display = base % 12;
    if (display === 0) display = 12;
    return `${display}:00 ${am ? "a.m." : "p.m."}`;
  }

  const mergeMessages = React.useCallback(
    (
      incoming: Msg | Msg[],
      options: { replace?: boolean; fromServer?: boolean } = {},
    ) => {
      const arr = Array.isArray(incoming) ? incoming : [incoming];
      setMessages((prev) => {
        if (options.replace && arr.length === 0) {
          return prev;
        }
        let base = options.replace
          ? prev.filter((m) => m.id.startsWith("tmp_"))
          : [...prev];
        // Prepare server-offer/quote ids for dedupe of optimistic messages
        const serverOfferIds = new Set<string>();
        const serverQuoteIds = new Set<string>();
        const serverSystemOfferKeys = new Set<string>();
        let hasServerQuote = false;
        for (const it of arr) {
          if (
            it.messageType === "offer" &&
            it.payload &&
            typeof it.payload === "object"
          ) {
            const po = it.payload as Record<string, unknown>;
            const oid =
              typeof po.offer_id === "string" ? (po.offer_id as string) : null;
            if (oid) serverOfferIds.add(oid);
          }
          if (
            it.messageType === "quote" &&
            it.payload &&
            typeof it.payload === "object"
          ) {
            hasServerQuote = true;
            const pq = it.payload as Record<string, unknown>;
            const qid =
              typeof pq.quote_id === "string" ? (pq.quote_id as string) : null;
            if (qid) serverQuoteIds.add(qid);
          }
          if (
            it.messageType === "system" &&
            it.payload &&
            typeof it.payload === "object"
          ) {
            const ps = it.payload as Record<string, unknown>;
            const oid =
              typeof ps.offer_id === "string" ? (ps.offer_id as string) : null;
            const st =
              typeof ps.status === "string" ? (ps.status as string) : null;
            if (oid && st) serverSystemOfferKeys.add(`${oid}:${st}`);
          }
        }
        if (options.fromServer) {
          base = base.filter((m) => {
            if (!m.id.startsWith("tmp_")) return true;
            // Always drop tmp 'offer' bound to an offer_id that now exists in server msgs
            if (
              m.messageType === "offer" &&
              m.payload &&
              typeof m.payload === "object"
            ) {
              const po = m.payload as Record<string, unknown>;
              const oid =
                typeof po.offer_id === "string"
                  ? (po.offer_id as string)
                  : null;
              if (oid && serverOfferIds.has(oid)) return false;
            }
            if (
              m.messageType === "quote" &&
              m.payload &&
              typeof m.payload === "object"
            ) {
              const pq = m.payload as Record<string, unknown>;
              const qid =
                typeof pq.quote_id === "string"
                  ? (pq.quote_id as string)
                  : null;
              if (qid && serverQuoteIds.has(qid)) return false;
              // Fallback: drop tmp quotes once server messages arrive to avoid duplicados
              if (hasServerQuote) return false;
            }
            if (
              m.messageType === "system" &&
              m.payload &&
              typeof m.payload === "object"
            ) {
              const ps = m.payload as Record<string, unknown>;
              const oid =
                typeof ps.offer_id === "string"
                  ? (ps.offer_id as string)
                  : null;
              const st =
                typeof ps.status === "string" ? (ps.status as string) : null;
              if (oid && st && serverSystemOfferKeys.has(`${oid}:${st}`))
                return false;
            }
            // Body-based dedupe only applies to my own optimistic text messages
            if (meId) {
              if (m.senderId !== "me") return true;
              const trimmed = m.body.trim();
              return !arr.some(
                (msg) => msg.senderId === meId && msg.body.trim() === trimmed,
              );
            }
            return true;
          });
        }
        const map = new Map<string, Msg>();
        for (const item of base) map.set(item.id, item);
        for (const msg of arr) {
          if (map.has(msg.id)) continue;
          map.set(msg.id, msg);
        }
        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
      const ensureSession = async (
        force?: boolean,
      ): Promise<Session | null> => {
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
      } catch {
        // In dev, allow x-user-id fallback without failing
        if (meId && !isProd) {
          headers["x-user-id"] = meId;
        }
        session = null;
      }
      if (session && session.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
        headers["x-access-token"] = session.access_token;
        if (
          session.refresh_token &&
          lastSyncedTokenRef.current !== session.access_token &&
          !syncInFlightRef.current
        ) {
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
    // Si nos pasan userId desde fuera, úsalo de inmediato para habilitar acciones por rol
    if (userId && userId !== meId) setMeId(userId);
  }, [userId, meId]);

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
  const loadOnsiteSummary = React.useCallback(async () => {
    if (!conversationId) return;
    try {
      const { data } = await supabaseBrowser
        .from("onsite_quote_requests")
        .select("id, status, remuneration_applied_at, updated_at, created_at")
        .eq("conversation_id", conversationId)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(20);
      const rows = Array.isArray(data)
        ? (data as Array<OnsiteCtaSummary | null>).filter(
            (row): row is OnsiteCtaSummary =>
              Boolean(row?.id) && typeof row?.status === "string",
          )
        : [];
      if (!rows.length) {
        setOnsiteDbSummary(null);
        return;
      }
      setOnsiteDbSummary(rows[0] ?? null);
    } catch {
      // fallback to message-derived status when query fails
    }
  }, [conversationId]);
  const load = React.useCallback(
    async (withSpinner = true, options: { silent?: boolean } = {}) => {
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
          if (!options.silent) {
            toast.error(
              getChatFriendlyError(
                {
                  message: data?.error || "HISTORY_LOAD_FAILED",
                  status: res.status,
                },
                "chat.history.load",
              ),
            );
          }
          return;
        }
        const mapped = Array.isArray(data?.data)
          ? ((data?.data ?? []).map(mapHistoryRow).filter(Boolean) as Msg[])
          : [];
        mergeMessages(mapped, { replace: true, fromServer: true });
        if (data?.participants) setParticipants(data.participants);
        if (data?.request_id) setRequestId(data.request_id);
        await loadOnsiteSummary();
      } catch (error) {
        if (!options.silent) {
          toast.error(getChatFriendlyError(error, "chat.history.load"));
        }
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [conversationId, getAuthHeaders, loadOnsiteSummary, mergeMessages],
  );
  React.useEffect(() => {
    void load();
  }, [load]);
  const scheduleConversationResync = React.useCallback(
    (
      reason: string,
      options: {
        delayMs?: number;
        pollAttempts?: number;
        pollIntervalMs?: number;
      } = {},
    ) => {
      const delayMs = options.delayMs ?? 250;
      const pollAttempts = Math.max(0, options.pollAttempts ?? 0);
      const pollIntervalMs = Math.max(250, options.pollIntervalMs ?? 1200);
      const token = `${reason}:${conversationId}`;
      if (lastResyncTokenRef.current === token && resyncInFlightRef.current) {
        return;
      }
      lastResyncTokenRef.current = token;
      if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
      resyncTimerRef.current = setTimeout(() => {
        if (resyncInFlightRef.current) return;
        resyncInFlightRef.current = true;
        void load(false, { silent: true }).finally(() => {
          resyncInFlightRef.current = false;
        });
      }, delayMs);

      if (pollAttempts <= 0) return;
      if (
        fallbackPollRef.current.active &&
        fallbackPollRef.current.token === token
      ) {
        return;
      }
      fallbackPollRef.current = { token, active: true };
      void (async () => {
        for (let attempt = 0; attempt < pollAttempts; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          if (fallbackPollRef.current.token !== token) break;
          await load(false, { silent: true });
        }
        if (fallbackPollRef.current.token === token) {
          fallbackPollRef.current = { token: null, active: false };
        }
      })();
    },
    [conversationId, load],
  );
  // When auth state (meId) becomes available, try to reload history without spinner
  React.useEffect(() => {
    if (conversationId && meId) {
      void load(false, { silent: true });
      void loadOnsiteSummary();
    }
  }, [meId, conversationId, load, loadOnsiteSummary]);
  React.useEffect(
    () => () => {
      if (resyncTimerRef.current) {
        clearTimeout(resyncTimerRef.current);
        resyncTimerRef.current = null;
      }
      fallbackPollRef.current = { token: null, active: false };
    },
    [],
  );
  React.useEffect(() => {
    if (
      typeof requestBudgetProp === "number" &&
      Number.isFinite(requestBudgetProp)
    ) {
      setBudget(requestBudgetProp);
    }
  }, [requestBudgetProp]);
  React.useEffect(() => {
    if (requestIdProp && requestIdProp !== requestId)
      setRequestId(requestIdProp);
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
    if (!offerServiceDate) {
      setOfferServiceDate(resolveOfferServiceDate());
      if (offerServiceDateError) setOfferServiceDateError(false);
    }
  }, [
    offerDialogOpen,
    budget,
    requiredAt,
    offerAmount,
    offerServiceDate,
    requestTitle,
    resolveOfferServiceDate,
    offerServiceDateError,
  ]);
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
        const json = await parseJsonSafe<{ data?: Record<string, unknown> }>(
          res,
        );
        const data = json?.data ?? {};
        const budgetValue = Number((data?.budget as unknown) ?? NaN);
        if (!cancelled && Number.isFinite(budgetValue)) setBudget(budgetValue);
        const reqAt =
          typeof data?.required_at === "string"
            ? (data.required_at as string)
            : null;
        if (!cancelled) setRequiredAt(reqAt);
        const reqTitle =
          typeof data?.title === "string" ? (data.title as string) : null;
        if (!cancelled) setRequestTitle(reqTitle);
        const reqStatus =
          typeof data?.status === "string" ? (data.status as string) : null;
        if (!cancelled) setRequestStatus(reqStatus);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, getAuthHeaders]);

  // Header shows the peer (other participant), not necessarily the pro.
  React.useEffect(() => {
    const targetId = (() => {
      if (!participants) return null;
      const proId =
        typeof participants.pro_id === "string" ? participants.pro_id : null;
      const customerId =
        typeof participants.customer_id === "string"
          ? participants.customer_id
          : null;
      if (!proId || !customerId) return null;
      if (!meId) return null;
      if (meId === proId) return customerId;
      if (meId === customerId) return proId;
      return null;
    })();
    if (!targetId) return;
    if (headerProfileIdRef.current !== targetId) {
      headerProfileIdRef.current = targetId;
      setHeaderProfile(null);
    } else if (headerProfile) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const proRes = await fetch(
          `/api/profiles/${encodeURIComponent(targetId)}`,
          {
            headers,
            cache: "no-store",
            credentials: "include",
          },
        );
        const proJson = await parseJsonSafe<{
          ok?: boolean;
          data?: { full_name?: string | null; avatar_url?: string | null };
        }>(proRes);
        if (cancelled) return;
        if (
          !proRes.ok ||
          proJson?.ok === false ||
          !proJson?.data ||
          typeof proJson.data !== "object"
        ) {
          return;
        }
        setHeaderProfile({
          full_name:
            (proJson.data.full_name as string | null | undefined) ?? null,
          avatar_url:
            (proJson.data.avatar_url as string | null | undefined) ?? null,
        });
      } catch {
        /* ignore profile errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [participants, meId, getAuthHeaders, headerProfile]);
  React.useEffect(() => {
    if (!conversationId) return;
    const channel = supabaseBrowser
      .channel(`messages:${conversationId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        try {
          const from = (payload as any)?.payload?.from as string | undefined;
          if (from && from !== meId) {
            setOtherTyping(true);
            if (typingTimeoutRef.current)
              clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(
              () => setOtherTyping(false),
              3000,
            );
          }
        } catch {
          /* ignore */
        }
      })
      .on("broadcast", { event: "offer-accepted" }, async (eventPayload) => {
        try {
          const p = (eventPayload as any)?.payload as
            | { from?: string; offer_id?: string; checkout_url?: string | null }
            | undefined;
          const from = p?.from || null;
          const oid = (p?.offer_id || "").toString();
          const checkoutUrl =
            typeof p?.checkout_url === "string" ? p?.checkout_url : null;
          if (!oid) return;
          // Ignora eventos que emitimos nosotros mismos
          if (from && meId && from === meId) return;
          // Update any prior 'offer' message with same offer_id
          setMessages((prev) =>
            prev.map((m) => {
              if (
                m.messageType === "offer" &&
                m.payload &&
                typeof m.payload === "object"
              ) {
                const po = m.payload as Record<string, unknown>;
                if (po.offer_id === oid) {
                  const next = { ...po, status: "accepted" } as Record<
                    string,
                    unknown
                  >;
                  if (checkoutUrl) next.checkout_url = checkoutUrl;
                  return { ...m, payload: next };
                }
              }
              return m;
            }),
          );
          scheduleConversationResync("broadcast-offer-accepted", {
            delayMs: 200,
            pollAttempts: 3,
            pollIntervalMs: 1200,
          });
        } catch {
          /* ignore */
        }
      })
      .on("broadcast", { event: "offer-rejected" }, async (eventPayload) => {
        try {
          const p = (eventPayload as any)?.payload as
            | { from?: string; offer_id?: string; reason?: string | null }
            | undefined;
          const from = p?.from || null;
          const oid = (p?.offer_id || "").toString();
          const reason = typeof p?.reason === "string" ? p?.reason : null;
          if (!oid) return;
          if (from && meId && from === meId) return; // ignore own broadcast
          const createdAtIso = new Date().toISOString();
          const optimistic: Msg = {
            id: `tmp_sys_${oid}_rejected`,
            senderId: from || "system",
            body: reason ? `Oferta rechazada: ${reason}` : "Oferta rechazada",
            createdAt: createdAtIso,
            messageType: "system",
            payload: reason
              ? { offer_id: oid, status: "rejected", reason }
              : { offer_id: oid, status: "rejected" },
          };
          mergeMessages(optimistic, { fromServer: true });
          // Update any prior 'offer' message with same offer_id
          setMessages((prev) =>
            prev.map((m) => {
              if (
                m.messageType === "offer" &&
                m.payload &&
                typeof m.payload === "object"
              ) {
                const po = m.payload as Record<string, unknown>;
                if (po.offer_id === oid)
                  return {
                    ...m,
                    payload: {
                      ...po,
                      status: "rejected",
                      reason: reason ?? (po as any)?.reason,
                    },
                  } as Msg;
              }
              return m;
            }),
          );
          scheduleConversationResync("broadcast-offer-rejected", {
            delayMs: 200,
            pollAttempts: 2,
            pollIntervalMs: 1000,
          });
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
  }, [conversationId, mergeMessages, meId, scheduleConversationResync]);

  // Hook: realtime messages + attachments
  useChatRealtime(conversationId, {
    onRecoverNeeded: () => {
      scheduleConversationResync("realtime-recover", {
        delayMs: 200,
        pollAttempts: 2,
        pollIntervalMs: 1200,
      });
    },
    onMessageInsert: (row) => {
      let parsedPayload: Record<string, unknown> | null = null;
      const rawPayload = row.payload;
      if (rawPayload) {
        if (typeof rawPayload === "string" && rawPayload.trim().length) {
          try {
            parsedPayload = JSON.parse(rawPayload) as Record<string, unknown>;
          } catch {
            parsedPayload = null;
          }
        } else if (typeof rawPayload === "object") {
          parsedPayload = rawPayload as Record<string, unknown>;
        }
      }
      const msg: Msg = {
        id: row.id,
        senderId: row.sender_id,
        body: (row.body ?? row.text ?? "").toString(),
        createdAt: row.created_at,
        readBy: Array.isArray(row.read_by)
          ? (row.read_by as unknown[]).map((v) => String(v))
          : [],
        messageType: row.message_type ? String(row.message_type) : "text",
        payload: parsedPayload,
        attachments: [],
      };
      // If this is the DB-confirmed 'offer' message, drop any optimistic temp bound to the same offer_id
      try {
        if (
          msg.messageType === "offer" &&
          msg.payload &&
          typeof msg.payload === "object"
        ) {
          const p = msg.payload as Record<string, unknown>;
          const oid =
            typeof p.offer_id === "string" ? (p.offer_id as string) : null;
          if (oid) removeMessageById(`tmp_b_${oid}`);
        }
      } catch {
        /* ignore */
      }
      try {
        if (
          msg.messageType === "system" &&
          msg.payload &&
          typeof msg.payload === "object"
        ) {
          const p = msg.payload as Record<string, unknown>;
          const st = typeof p.status === "string" ? p.status : null;
          const oid = typeof p.offer_id === "string" ? p.offer_id : null;
          if (st === "accepted" && oid) {
            removeMessageById(`tmp_sys_${oid}_accepted`);
            // Update any prior 'offer' message for same offer_id to accepted
            setMessages((prev) =>
              prev.map((m) => {
                if (
                  m.messageType === "offer" &&
                  m.payload &&
                  typeof m.payload === "object"
                ) {
                  const po = m.payload as Record<string, unknown>;
                  if (po.offer_id === oid) {
                    return { ...m, payload: { ...po, status: "accepted" } };
                  }
                }
                return m;
              }),
            );
          } else if (st === "rejected" && oid) {
            removeMessageById(`tmp_sys_${oid}_rejected`);
            const reason = typeof p.reason === "string" ? p.reason : null;
            // Update any prior 'offer' message for same offer_id to rejected + reason
            setMessages((prev) =>
              prev.map((m) => {
                if (
                  m.messageType === "offer" &&
                  m.payload &&
                  typeof m.payload === "object"
                ) {
                  const po = m.payload as Record<string, unknown>;
                  if (po.offer_id === oid) {
                    const next = { ...po, status: "rejected" } as Record<
                      string,
                      unknown
                    >;
                    if (reason) (next as any).reason = reason;
                    return { ...m, payload: next };
                  }
                }
                return m;
              }),
            );
          }
        }
      } catch {
        /* ignore */
      }
      const existing = messagesRef.current || [];
      if (existing.some((m) => m.id === msg.id)) return;
      if (
        msg.messageType === "system" &&
        msg.payload &&
        typeof msg.payload === "object"
      ) {
        const p = msg.payload as Record<string, unknown>;
        const st = typeof p.status === "string" ? p.status : null;
        const oid = typeof p.offer_id === "string" ? p.offer_id : null;
        if (st === "accepted" && oid) {
          const hasDuplicate = existing.some((m) => {
            if (
              m.messageType !== "system" ||
              !m.payload ||
              typeof m.payload !== "object"
            )
              return false;
            const mp = m.payload as Record<string, unknown>;
            return mp.offer_id === oid && mp.status === st;
          });
          if (hasDuplicate) return;
        }
      }
      mergeMessages(msg, { fromServer: true });
      if (
        msg.messageType === "system" ||
        msg.messageType === "offer" ||
        msg.messageType === "quote"
      ) {
        scheduleConversationResync(`message-${msg.messageType}`, {
          delayMs: 180,
          pollAttempts: 3,
          pollIntervalMs: 1100,
        });
      }
    },
    onMessageUpdate: (row) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === row.id);
        if (idx === -1) return prev;
        const current = prev[idx];
        const rawPayload = row.payload;
        let nextPayload: Record<string, unknown> | null =
          current.payload ?? null;
        if (rawPayload && typeof rawPayload === "object") {
          nextPayload = rawPayload as Record<string, unknown>;
        } else if (typeof rawPayload === "string" && rawPayload.trim().length) {
          try {
            nextPayload = JSON.parse(rawPayload) as Record<string, unknown>;
          } catch {
            nextPayload = current.payload ?? null;
          }
        }
        const nextMsg: Msg = {
          ...current,
          body: (row.body ?? row.text ?? current.body ?? "").toString(),
          createdAt: row.created_at || current.createdAt,
          messageType: row.message_type
            ? String(row.message_type)
            : current.messageType,
          payload: nextPayload,
          readBy: Array.isArray(row.read_by)
            ? (row.read_by as unknown[]).map((v) => String(v))
            : current.readBy,
        };
        const copy = [...prev];
        copy[idx] = nextMsg;
        return copy;
      });
      scheduleConversationResync("message-update", {
        delayMs: 220,
        pollAttempts: 1,
        pollIntervalMs: 1200,
      });
    },
    onAttachmentInsert: (r) => {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug(
          "ui addAttachment <-",
          r.message_id,
          r.filename,
          r.storage_path,
        );
      }
      setMessages((prev) =>
        appendAttachment(prev, r.message_id, {
          id: r.id,
          filename: r.filename,
          mime_type: r.mime_type,
          byte_size: r.byte_size ?? null,
          width: r.width ?? null,
          height: r.height ?? null,
          storage_path: r.storage_path,
          created_at: r.created_at,
        }),
      );
      scheduleConversationResync("attachment-insert", {
        delayMs: 260,
        pollAttempts: 2,
        pollIntervalMs: 900,
      });
    },
    onAttachmentDelete: (r) => {
      setMessages((prev) => removeAttachment(prev, r.message_id, r.id));
      scheduleConversationResync("attachment-delete", {
        delayMs: 180,
        pollAttempts: 1,
        pollIntervalMs: 800,
      });
    },
  });
  const viewerRole = React.useMemo(() => {
    if (!participants || !meId) return "guest" as const;
    if (participants?.customer_id === meId) return "customer" as const;
    if (participants.pro_id === meId) return "professional" as const;
    return "guest" as const;
  }, [participants, meId]);
  const offerSummaries = React.useMemo(() => {
    const map = new Map<
      string,
      {
        offerId: string;
        status: string;
        checkoutUrl: string | null;
        title?: string | null;
        amount?: number | null;
        currency?: string | null;
        reason?: string | null;
      }
    >();
    for (const msg of messagesState) {
      const payload = msg.payload;
      if (!payload || typeof payload !== "object") continue;
      const rawId = (payload as Record<string, unknown>).offer_id;
      if (typeof rawId !== "string" || !rawId) continue;
      const summary = map.get(rawId) ?? {
        offerId: rawId,
        status: "pending",
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
        const amount =
          typeof amountRaw === "number" ? amountRaw : Number(amountRaw ?? NaN);
        summary.amount = Number.isFinite(amount) ? amount : summary.amount;
        summary.currency =
          typeof currencyRaw === "string" && currencyRaw.trim().length
            ? currencyRaw.toUpperCase()
            : summary.currency;
        summary.status = normalizeStatus(
          (payload as Record<string, unknown>).status as string | undefined,
        );
        const checkoutUrlRaw = (payload as Record<string, unknown>)
          .checkout_url;
        summary.checkoutUrl =
          typeof checkoutUrlRaw === "string"
            ? checkoutUrlRaw
            : summary.checkoutUrl;
      } else if (msg.messageType === "system") {
        const statusRaw = (payload as Record<string, unknown>).status;
        if (typeof statusRaw === "string")
          summary.status = normalizeStatus(statusRaw);
        const checkoutUrlRaw = (payload as Record<string, unknown>)
          .checkout_url;
        if (typeof checkoutUrlRaw === "string")
          summary.checkoutUrl = checkoutUrlRaw;
        if (summary.status === "rejected") {
          const reasonRaw = (payload as Record<string, unknown>).reason;
          if (typeof reasonRaw === "string" && reasonRaw.trim().length)
            summary.reason = reasonRaw;
        }
      }
      map.set(rawId, summary);
    }
    return map;
  }, [messagesState]);
  const otherUserId = React.useMemo(() => {
    if (!participants || !meId) return undefined;
    return participants?.customer_id === meId
      ? participants.pro_id
      : participants?.customer_id;
  }, [participants, meId]);
  void otherUserId;
  async function postMessage(
    body: string,
    attempt = 0,
  ): Promise<
    | {
        ok: true;
        id: string | null;
        createdAt: string;
        body: string;
        payload: Record<string, unknown> | null;
      }
    | { ok: false; error: string }
  > {
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
        data?: {
          id?: string;
          created_at?: string;
          body?: unknown;
          payload?: unknown;
        };
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
        const message =
          json?.message || json?.error || getContactPolicyMessage();
        return { ok: false, error: message };
      }
      if (!res.ok || json?.ok === false) {
        const message =
          json?.message || json?.error || "No se pudo enviar el mensaje";
        if (attempt === 0 && /auth session missing/i.test(message)) {
          lastSyncedTokenRef.current = null;
          return postMessage(body, attempt + 1);
        }
        return { ok: false, error: message };
      }
      const id = json?.data?.id ? String(json.data.id) : null;
      const createdAt = json?.data?.created_at
        ? String(json.data.created_at)
        : new Date().toISOString();
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
      toast.error(getChatFriendlyError(result.error, "chat.send-text"));
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
    scheduleConversationResync("send-text", {
      delayMs: 120,
      pollAttempts: 1,
      pollIntervalMs: 900,
    });
    return true;
  }
  function hasActiveOfferInChat(): boolean {
    for (const [, summary] of offerSummaries) {
      const status = normalizeStatus(summary.status).toLowerCase();
      if (
        status !== "accepted" &&
        status !== "rejected" &&
        status !== "paid" &&
        status !== "canceled" &&
        status !== "cancelled" &&
        status !== "expired"
      ) {
        return true;
      }
    }
    return false;
  }
  async function submitOffer() {
    const ACTIVE_OFFER_MSG =
      "Oferta de contratación activa, pide al professional que Acepte o Rechaze la Oferta activa en el chat.";
    if (viewerRole !== "customer") {
      toast.error("Solo el cliente puede crear ofertas");
      return;
    }
    if (hasActiveOfferInChat()) {
      toast.error(ACTIVE_OFFER_MSG);
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
    const serviceDateValue = offerServiceDate.trim();
    if (!serviceDateValue) {
      toast.error("Selecciona la fecha en la que requieres tu servicio");
      setOfferServiceDateError(true);
      return;
    }
    if (offerServiceDateError) setOfferServiceDateError(false);
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
      if (
        !offerFlexibleSchedule &&
        Array.isArray(offerScheduleRange) &&
        offerScheduleRange.length >= 2
      ) {
        const a = Math.max(
          0,
          Math.min(24, Math.floor(offerScheduleRange[0] ?? 0)),
        );
        const b = Math.max(
          0,
          Math.min(24, Math.floor(offerScheduleRange[1] ?? 0)),
        );
        const sh = Math.min(a, b);
        const eh = Math.max(a, b);
        scheduleNote =
          sh === eh
            ? `Horario: ${formatHour(sh)}`
            : `Horario: ${formatHour(sh)} — ${formatHour(eh)}`;
      } else if (offerFlexibleSchedule) {
        flexibleNote = "Horario flexible";
      }
      const finalDescription = [userDesc, flexibleNote, scheduleNote]
        .filter(Boolean)
        .join("\n");
      if (finalDescription) payload.description = finalDescription;
      if (serviceDateValue) {
        const d = fromYMD(serviceDateValue) ?? new Date(serviceDateValue);
        if (!Number.isNaN(d.getTime())) {
          // Normalize to start-of-day local, then to ISO
          const localStart = new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
          );
          payload.serviceDate = localStart.toISOString();
        }
      }
      // horario
      payload.flexibleSchedule = offerFlexibleSchedule;
      if (
        !offerFlexibleSchedule &&
        Array.isArray(offerScheduleRange) &&
        offerScheduleRange.length >= 2
      ) {
        const a = Math.max(
          0,
          Math.min(24, Math.floor(offerScheduleRange[0] ?? 0)),
        );
        const b = Math.max(
          0,
          Math.min(24, Math.floor(offerScheduleRange[1] ?? 0)),
        );
        payload.scheduleStartHour = Math.min(a, b);
        payload.scheduleEndHour = Math.max(a, b);
      }
      const res = await fetch(`/api/conversations/${conversationId}/offers`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await parseJsonSafe<{
        ok?: boolean;
        error?: string;
        offer?: Record<string, unknown>;
        message?: string;
      }>(res);
      if (!res.ok || json?.ok === false) {
        const code = json?.error || "No se pudo crear la oferta";
        if (code === "ACTIVE_OFFER_EXISTS" || res.status === 409) {
          const serverMsg =
            typeof json?.message === "string" && json.message.trim().length
              ? json.message
              : null;
          toast.error(serverMsg || ACTIVE_OFFER_MSG);
          return;
        }
        throw new Error(
          code === "VALIDATION_ERROR"
            ? "No se pudo crear la oferta"
            : code || "No se pudo crear la oferta",
        );
      }

      // Best-effort: asegurar que exista un agreement para conteo/seguimiento
      try {
        if (requestId && participants?.pro_id) {
          const proId = participants.pro_id;
          const agreeUrl = `/api/requests/${encodeURIComponent(requestId)}/agreements`;
          const existing = await fetch(agreeUrl, {
            headers,
            cache: "no-store",
            credentials: "include",
          });
          const existingJson = await parseJsonSafe<{
            data?: Array<{ professional_id?: string }>;
          }>(existing);
          const hasOne =
            existing.ok &&
            Array.isArray(existingJson?.data) &&
            existingJson?.data?.some(
              (a) => (a?.professional_id as string | undefined) === proId,
            );
          if (!hasOne) {
            await fetch(`/api/agreements`, {
              method: "POST",
              headers,
              credentials: "include",
              body: JSON.stringify({
                request_id: requestId,
                professional_id: proId,
                amount: Number(amountValue.toFixed(2)),
                status: "negotiating",
              }),
            }).catch(() => undefined);
          }
        }
      } catch {
        /* ignore agreement creation errors */
      }

      // Optimistic offer message so it appears immediately
      try {
        const createdAtIso = new Date().toISOString();
        const offerId = String(
          (json?.offer as Record<string, unknown> | undefined)?.id ||
            `tmp_offer_${Date.now()}`,
        );
        const tmpId = `tmp_b_${offerId}`; // bind temp message to offer id for easy dedupe
        const payloadMsg: Record<string, unknown> = {
          offer_id: offerId,
          title,
          amount: Number(amountValue.toFixed(2)),
          currency: (offerCurrency || "MXN").toUpperCase(),
          status: "sent",
        };
        if (finalDescription) payloadMsg.description = finalDescription;
        if (
          typeof (payload as Record<string, unknown>).serviceDate === "string"
        ) {
          payloadMsg.service_date = (
            payload as Record<string, string>
          ).serviceDate;
        }
        const optimisticOffer: Msg = {
          id: tmpId,
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
      await load(false, { silent: true });
      scheduleConversationResync("offer-created", {
        delayMs: 180,
        pollAttempts: 3,
        pollIntervalMs: 1200,
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Error";
      const normalized =
        typeof raw === "string" && raw.includes("ACTIVE_OFFER_EXISTS")
          ? ACTIVE_OFFER_MSG
          : getChatFriendlyError(error, "chat.offer.create");
      toast.error(normalized);
    } finally {
      setOfferSubmitting(false);
    }
  }
  async function handleAcceptOffer(
    offerId: string,
    attempt = 0,
  ): Promise<void> {
    if (viewerRole !== "professional") {
      toast.error("Solo el profesional puede aceptar la oferta");
      return;
    }
    const summary = offerSummaries.get(offerId);
    if (!summary || normalizeStatus(summary.status) !== "pending") {
      toast.error("La oferta ya no esta disponible");
      return;
    }
    setAcceptingOfferId(offerId);
    try {
      // Intento 1: PostgREST directo (rápido, condicionado a pending) usando token del usuario
      try {
        const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        const headers = await getAuthHeaders();
        const hasBearer =
          typeof (headers as any).Authorization === "string" &&
          (headers as any).Authorization.startsWith("Bearer ");
        if (supaUrl && anonKey && hasBearer) {
          const restUrl = `${supaUrl.replace(/\/$/, "")}/rest/v1/offers?id=eq.${encodeURIComponent(offerId)}&status=eq.pending&select=id,status,checkout_url`;
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
            try {
              rows = await res.json();
            } catch {
              rows = [];
            }
            const arr = Array.isArray(rows)
              ? (rows as Array<{
                  id?: string;
                  status?: string;
                  checkout_url?: string | null;
                }>)
              : [];
            if (
              arr.length > 0 &&
              String(arr[0]?.status || "").toLowerCase() === "accepted"
            ) {
              toast.success("Oferta aceptada");
              await load(false, { silent: true });
              scheduleConversationResync("offer-accepted", {
                delayMs: 180,
                pollAttempts: 4,
                pollIntervalMs: 1200,
              });
              return;
            }
          }
        }
      } catch {
        /* fallback to server routes */
      }

      const headers = await getAuthHeaders();
      // Aceptación por conversación (servidor)
      const res = await fetch(
        `/api/conversations/${conversationId}/offers/accept`,
        {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ conversationId }),
        },
      );
      const json = await parseJsonSafe<{
        ok?: boolean;
        error?: string;
        checkoutUrl?: string;
      }>(res);
      if (res.ok && json?.ok !== false) {
        toast.success("Oferta aceptada");
        await load(false, { silent: true });
        scheduleConversationResync("offer-accepted", {
          delayMs: 180,
          pollAttempts: 4,
          pollIntervalMs: 1200,
        });
        return;
      }
      // Fallback por id
      const res2 = await fetch(`/api/offers/${offerId}/accept`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ conversationId }),
      });
      const json2 = await parseJsonSafe<{
        ok?: boolean;
        error?: string;
        checkoutUrl?: string;
      }>(res2);
      if (res2.ok && json2?.ok !== false) {
        toast.success("Oferta aceptada");
        await load(false, { silent: true });
        scheduleConversationResync("offer-accepted", {
          delayMs: 180,
          pollAttempts: 4,
          pollIntervalMs: 1200,
        });
        return;
      }
      if ((res.status === 404 || res2.status === 404) && attempt === 0) {
        await load(false, { silent: true });
        const nextId = findLatestSentOfferId();
        if (nextId && nextId !== offerId) {
          await handleAcceptOffer(nextId, attempt + 1);
          return;
        }
      }
      const errText = (
        (json?.error || json2?.error || "").toString() || ""
      ).toUpperCase();
      if (
        res.status === 409 ||
        res2.status === 409 ||
        errText.includes("LOCKED") ||
        errText.includes("INVALID_STATUS")
      ) {
        toast.message?.("Procesando oferta…", {
          description: "Sincronizando estado",
        });
        for (let i = 0; i < 8; i++) {
          await new Promise((r) => setTimeout(r, 600));
          await load(false, { silent: true });
          const st = normalizeStatus(getOfferStatusFromMessages(offerId));
          if (st === "accepted") {
            toast.success("Oferta aceptada");
            return;
          }
          if (st !== "pending") {
            toast.error("La oferta ya no está disponible");
            return;
          }
        }
        throw new Error("No se pudo aceptar la oferta. Intenta de nuevo.");
      }
      throw new Error(
        json?.error || json2?.error || "No se pudo aceptar la oferta",
      );
    } catch (error) {
      const message = (
        error instanceof Error ? error.message : "Error"
      ).toString();
      if (/LOCKED/i.test(message) || /INVALID_STATUS/i.test(message)) {
        toast.error("No se pudo aceptar la oferta. Intenta de nuevo.");
      } else {
        toast.error(getChatFriendlyError(error, "chat.offer.accept"));
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
      if (
        typeof oid === "string" &&
        typeof status === "string" &&
        normalizeStatus(status) === "pending"
      ) {
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
    const st = current
      ? String(normalizeStatus(current.status) || "").toLowerCase()
      : "";
    if (!current || (st !== "pending" && st !== "sent")) {
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
      // Optimistic system message so ambos lados lo vean de inmediato
      try {
        const createdAtIso = new Date().toISOString();
        mergeMessages(
          {
            id: `tmp_sys_${rejectTarget}_rejected`,
            senderId: meId ?? "me",
            body: `Oferta rechazada: ${reasonPayload}`,
            createdAt: createdAtIso,
            messageType: "system",
            payload: {
              offer_id: rejectTarget,
              status: "rejected",
              reason: reasonPayload,
            },
          },
          { fromServer: true },
        );
        // Update original offer message status locally to rejected
        setMessages((prev) =>
          prev.map((m) => {
            if (
              m.messageType === "offer" &&
              m.payload &&
              typeof m.payload === "object"
            ) {
              const po = m.payload as Record<string, unknown>;
              if (po.offer_id === rejectTarget) {
                return {
                  ...m,
                  payload: { ...po, status: "rejected", reason: reasonPayload },
                } as Msg;
              }
            }
            return m;
          }),
        );
        // Broadcast to other participant so they see immediate update
        try {
          if (channelRef.current) {
            void channelRef.current.send({
              type: "broadcast",
              event: "offer-rejected",
              payload: {
                from: meId || "me",
                offer_id: rejectTarget,
                reason: reasonPayload,
              },
            });
          }
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
      setRejectOpen(false);
      setRejectReason("");
      setRejectExtra("");
      setRejectTarget(null);
      await load(false, { silent: true });
      scheduleConversationResync("offer-rejected", {
        delayMs: 180,
        pollAttempts: 3,
        pollIntervalMs: 1100,
      });
    } catch (error) {
      toast.error(getChatFriendlyError(error, "chat.offer.reject"));
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
    scheduleConversationResync("send-text", {
      delayMs: 120,
      pollAttempts: 1,
      pollIntervalMs: 900,
    });
    return true;
  }
  const loadingState = loading ? (
    <div className="flex-1 p-3 text-sm text-slate-500" role="status" aria-busy>
      Cargando...
    </div>
  ) : null;
  const acceptedForPay = React.useMemo(() => {
    // Pick any accepted offer to enable checkout CTA
    for (const [, summary] of offerSummaries) {
      if (normalizeStatus(summary.status) === "accepted") return summary;
    }
    return null as {
      offerId: string;
      status: string;
      checkoutUrl: string | null;
      title?: string | null;
      amount?: number | null;
      currency?: string | null;
    } | null;
  }, [offerSummaries]);

  // Hide CTAs after payment is completed (paid) or scheduled
  const hasPaid = React.useMemo(() => {
    for (const [, summary] of offerSummaries) {
      if (normalizeStatus(summary.status) === "paid") return true;
    }
    for (const m of messagesState) {
      if (
        m.messageType === "system" &&
        m.payload &&
        typeof m.payload === "object"
      ) {
        const st = (m.payload as Record<string, unknown>)["status"];
        if (typeof st === "string" && normalizeStatus(st) === "paid")
          return true;
      }
    }
    return false;
  }, [offerSummaries, messagesState]);

  // Client should not see "Contratar" once an offer is accepted/paid.
  const hasAcceptedOffer = React.useMemo(() => {
    for (const m of messagesState) {
      if (!m?.payload || typeof m.payload !== "object") continue;
      const p = m.payload as Record<string, unknown>;
      if (!p.offer_id) continue;
      const st = typeof p.status === "string" ? p.status.toLowerCase() : "";
      if (st === "accepted" || st === "paid") return true;
    }
    return false;
  }, [messagesState]);

  const isPaidOrScheduled = React.useMemo(() => {
    if (hasPaid) return true;
    const st = (requestStatus || "").toLowerCase();
    return (
      st === "scheduled" ||
      st === "in_process" ||
      st === "inprogress" ||
      st === "paid"
    );
  }, [hasPaid, requestStatus]);

  const latestOfferId = React.useMemo(() => {
    for (let i = messagesState.length - 1; i >= 0; i--) {
      const payload = messagesState[i]?.payload as Record<
        string,
        unknown
      > | null;
      if (!payload) continue;
      const offerId = payload.offer_id;
      if (typeof offerId === "string" && offerId.trim().length) return offerId;
    }
    return null;
  }, [messagesState]);

  const offerStatus = React.useMemo(() => {
    if (hasPaid) return "paid";
    if (!latestOfferId) return null;
    return getOfferStatusFromMessages(latestOfferId);
  }, [hasPaid, latestOfferId]);

  const allowContact = React.useMemo(
    () =>
      isContactPolicyLifted({
        offerStatus,
        requestStatus,
      }),
    [offerStatus, requestStatus],
  );

  const onsiteStatusSummary = React.useMemo(() => {
    let latest: {
      onsiteId: string;
      status: string;
    } | null = null;
    for (let i = messagesState.length - 1; i >= 0; i--) {
      const message = messagesState[i];
      if (!message.payload || typeof message.payload !== "object") continue;
      const payload = message.payload as Record<string, unknown>;
      const onsiteId =
        typeof payload.onsite_request_id === "string"
          ? payload.onsite_request_id
          : null;
      const status =
        typeof payload.status === "string"
          ? payload.status.toLowerCase()
          : null;
      if (!onsiteId || !status) continue;
      latest = { onsiteId, status };
      break;
    }
    return latest;
  }, [messagesState]);

  const hideOnsiteQuoteCta = React.useMemo(() => {
    const status =
      onsiteDbSummary?.status?.toLowerCase() ??
      onsiteStatusSummary?.status ??
      "";
    // Hide while there is an onsite flow active or already paid/completed.
    // Allow retry only for terminal non-useful states such as rejected/canceled/no_show.
    return (
      status === "requested" ||
      status === "deposit_pending" ||
      status === "deposit_paid" ||
      status === "accepted" ||
      status === "scheduled" ||
      status === "completed"
    );
  }, [onsiteDbSummary, onsiteStatusSummary]);

  // When paid is detected, best-effort update request status to 'in_process'
  React.useEffect(() => {
    if (!hasPaid) return;
    if (!requestId) return;
    (async () => {
      try {
        await fetch(`/api/requests/${encodeURIComponent(requestId)}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          credentials: "include",
          body: JSON.stringify({ nextStatus: "in_process" }),
        });
      } catch {
        // ignore
      }
    })();
  }, [hasPaid, requestId]);

  // Payment dialog state (cliente paga dentro del modal)
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const feeAmount = acceptedForPay?.amount ?? null;
  const feeCurrency = acceptedForPay?.currency || "MXN";
  React.useEffect(() => {
    if (!acceptedForPay) setPaymentOpen(false);
  }, [acceptedForPay]);
  const handlePaymentSuccess = React.useCallback(() => {
    scheduleConversationResync("payment-success", {
      delayMs: 200,
      pollAttempts: 3,
      pollIntervalMs: 1200,
    });
    void load(false, { silent: true });
  }, [load, scheduleConversationResync]);

  const actionButtonsContent = (
    <>
      {(() => {
        const st = (requestStatus || "").toLowerCase();
        const baseLocked =
          st === "scheduled" ||
          st === "in_process" ||
          st === "inprogress" ||
          st === "finished" ||
          st === "completed";
        const stageLocked = ignoreStageLock ? false : baseLocked;
        return (
          participants &&
          meId === participants?.customer_id &&
          !isPaidOrScheduled &&
          !hideClientCtas &&
          !stageLocked
        );
      })() ? (
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {acceptedForPay ? (
              <Button onClick={() => setPaymentOpen(true)} variant="success">
                Continuar al pago
              </Button>
            ) : null}
          </div>
          <div>
            {!hasAcceptedOffer ? (
              <Button
                onClick={() => {
                  if (requestTitle && requestTitle.trim().length)
                    setOfferTitle(requestTitle);
                  setOfferAmountLocked(false);
                  setOfferServiceDate(resolveOfferServiceDate());
                  setOfferServiceDateError(false);
                  setOfferDialogOpen(true);
                }}
              >
                Contratar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}{" "}
      {/* pro CTAs now rendered via actionButtons to keep consistency across views */}
      {participants && meId === participants?.pro_id && !isPaidOrScheduled ? (
        <div className="p-3 flex items-center gap-2 border-t">
          <Button variant="outline" onClick={() => setQuoteOpen(true)}>
            Cotizar
          </Button>
          {!hideOnsiteQuoteCta ? (
            <Button variant="outline" onClick={() => setOnsiteOpen(true)}>
              Cotizar en sitio
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
  const actionButtons = stickyActionBar ? (
    <div className="sticky bottom-0 bg-white border-t shrink-0">
      {actionButtonsContent}
    </div>
  ) : (
    <div className="shrink-0">{actionButtonsContent}</div>
  );

  const typingIndicator = otherTyping ? <TypingIndicator /> : null;
  const statusHeader = (() => {
    if (!requestId || !requestStatus) return null;
    const label =
      UI_STATUS_LABELS[requestStatus as any as keyof typeof UI_STATUS_LABELS] ||
      requestStatus;
    const headerName =
      (headerProfile?.full_name && headerProfile.full_name.trim().length
        ? headerProfile.full_name
        : null) || (viewerRole === "professional" ? "Cliente" : "Usuario");
    return (
      <div className="border-b px-3 py-4 text-xs text-slate-600 flex items-center gap-3 bg-white">
        <button
          type="button"
          aria-label="Cerrar chat"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border text-slate-600 hover:bg-slate-100"
        >
          <span className="text-lg leading-none">←</span>
        </button>
        <AvatarWithSkeleton
          src={resolveChatAvatarSrc(headerProfile?.avatar_url || undefined)}
          fallbackSrc={CHAT_AVATAR_PLACEHOLDER}
          alt={headerName}
          sizeClass="size-10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate font-semibold text-sm text-slate-900">
              {headerName}
            </div>
            <div className="inline-flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-xs text-muted-foreground">
                Estatus:
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 border">
                {label}
              </span>
            </div>
          </div>
          <div className="truncate text-[12px] text-muted-foreground mt-0.5">
            {requestTitle || "Servicio"}
          </div>
        </div>
      </div>
    );
  })();

  async function patchRequestStatus(nextStatus: "in_process" | "completed") {
    if (!requestId) return;
    try {
      const res = await fetch(
        `/api/requests/${encodeURIComponent(requestId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          credentials: "include",
          body: JSON.stringify({ nextStatus }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(
          getChatFriendlyError(
            {
              message: json?.error || "REQUEST_STATUS_UPDATE_FAILED",
              status: res.status,
            },
            "chat.request-status.patch",
          ),
        );
        return;
      }
      const s = (json?.data?.status as string | null) ?? null;
      if (s) setRequestStatus(s);
      toast.success(
        nextStatus === "in_process"
          ? "Trabajo iniciado"
          : "Trabajo marcado como realizado",
      );
    } catch (e) {
      toast.error(getChatFriendlyError(e, "chat.request-status.patch"));
    }
  }
  const messageList = (
    <MessageList
      items={messagesState}
      conversationId={conversationId}
      currentUserId={meId ?? undefined}
      otherUserId={otherUserId}
      viewerRole={viewerRole}
      onAcceptOffer={handleAcceptOffer}
      onOfferAcceptedUI={(offerId, opts) => {
        try {
          // Update original offer message status locally to accepted
          setMessages((prev) =>
            prev.map((m) => {
              if (
                m.messageType === "offer" &&
                m.payload &&
                typeof m.payload === "object"
              ) {
                const po = m.payload as Record<string, unknown>;
                if (po.offer_id === offerId) {
                  const next = { ...po, status: "accepted" } as Record<
                    string,
                    unknown
                  >;
                  if (opts?.checkoutUrl) next.checkout_url = opts.checkoutUrl;
                  return { ...m, payload: next };
                }
              }
              return m;
            }),
          );
          // Broadcast to other participant so client sees Pay CTA without reload
          try {
            if (channelRef.current) {
              void channelRef.current.send({
                type: "broadcast",
                event: "offer-accepted",
                payload: {
                  from: meId || "me",
                  offer_id: offerId,
                  checkout_url: opts?.checkoutUrl ?? null,
                },
              });
            }
          } catch {
            /* ignore */
          }
          toast.success("Oferta aceptada");
        } catch {
          /* ignore */
        }
      }}
      onRejectOffer={handleOpenReject}
      actionOfferId={acceptingOfferId ?? rejectingOfferId}
      dataPrefix={dataPrefix}
      hideQuoteCta={isPaidOrScheduled}
      onOpenOfferDialog={(opts) => {
        if (requestTitle && requestTitle.trim().length)
          setOfferTitle(requestTitle);
        if (typeof opts?.amount === "number" && Number.isFinite(opts.amount)) {
          setOfferAmount(String(opts.amount));
          setOfferAmountLocked(true); // opened from quote message → lock amount
        }
        setOfferCurrency(
          opts?.currency &&
            typeof opts.currency === "string" &&
            opts.currency.trim().length
            ? opts.currency.toUpperCase()
            : "MXN",
        );
        setOfferServiceDate(resolveOfferServiceDate());
        setOfferServiceDateError(false);
        setOfferDialogOpen(true);
      }}
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
          setOfferAmountLocked(false);
          setOfferCurrency("MXN");
          setOfferServiceDate("");
          setOfferServiceDateError(false);
          setOfferScheduleRange([9, 17]);
          setOfferFlexibleSchedule(true);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear oferta</DialogTitle>
          <DialogDescription>
            Define el monto y los detalles antes de enviar la oferta.
          </DialogDescription>
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
              <label className="text-sm font-medium text-slate-700">
                Monto
              </label>
              <input
                type="number"
                className={`w-full border rounded px-3 py-2 text-sm ${offerAmountLocked ? "bg-neutral-100 text-neutral-700 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-300" : ""}`}
                value={offerAmount}
                onChange={(event) => setOfferAmount(event.target.value)}
                min="0"
                step="0.01"
                readOnly={offerAmountLocked}
                disabled={offerAmountLocked}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Moneda
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm bg-neutral-100 text-neutral-700 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-300"
                value={offerCurrency}
                onChange={(event) =>
                  setOfferCurrency(event.target.value.toUpperCase())
                }
                readOnly
                disabled
                maxLength={6}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Fecha objetivo
            </label>
            <input
              type="date"
              className={`w-full border rounded px-3 py-2 text-sm ${
                offerServiceDateError
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }`}
              value={offerServiceDate}
              onChange={(event) => {
                setOfferServiceDate(event.target.value);
                if (offerServiceDateError) setOfferServiceDateError(false);
              }}
              min={toYMD(new Date())}
              required
              aria-invalid={offerServiceDateError}
            />
          </div>
          <div className="space-y-2">
            <CompanyToggle
              id="offer-flexible"
              checked={offerFlexibleSchedule}
              onChange={setOfferFlexibleSchedule}
              label="Horario flexible"
              size="sm"
              className={offerFlexibleSchedule ? undefined : "opacity-90"}
            />
            {!offerFlexibleSchedule ? (
              <div className="px-1">
                <div className="text-xs text-muted-foreground mb-2">
                  Seleccionar horario.
                </div>
                <Slider
                  min={0}
                  max={24}
                  step={1}
                  minStepsBetweenThumbs={0}
                  value={offerScheduleRange}
                  onValueChange={(vals) => {
                    if (Array.isArray(vals) && vals.length >= 2) {
                      const a = Math.max(
                        0,
                        Math.min(24, Math.floor(vals[0] ?? 0)),
                      );
                      const b = Math.max(
                        0,
                        Math.min(24, Math.floor(vals[1] ?? 0)),
                      );
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
            <label className="text-sm font-medium text-slate-700">
              Descripcion
            </label>
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
          <Button
            variant="ghost"
            onClick={() => setOfferDialogOpen(false)}
            disabled={offerSubmitting}
          >
            Cancelar
          </Button>
          <Button onClick={submitOffer} disabled={offerSubmitting}>
            {offerSubmitting ? "Enviando..." : "Enviar oferta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Quote creation handled by QuoteComposerDialog component

  async function submitOnsite() {
    if (viewerRole !== "professional") {
      toast.error("Solo el profesional puede solicitar cotización en sitio");
      return;
    }
    setOnsiteSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const normalizedAmount = Number(onsiteAmount);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        toast.error("Ingresa un monto válido para la cotización en sitio");
        return;
      }
      const payload: Record<string, unknown> = {
        deposit_amount: Number(normalizedAmount.toFixed(2)),
        details: onsiteDetails.trim().length ? onsiteDetails.trim() : null,
        is_remunerable: onsiteRemunerable,
      };
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/onsite-quote-requests`,
        {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw {
          message: json?.error || "ONSITE_QUOTE_REQUEST_FAILED",
          detail: json?.detail || null,
          status: res.status,
        };
      }
      toast.success("Solicitud de cotización en sitio enviada");
      setOnsiteOpen(false);
      setOnsiteAmount("200");
      setOnsiteDetails("");
      setOnsiteRemunerable(false);
      await load(false, { silent: true });
      scheduleConversationResync("onsite-quote-request", {
        delayMs: 180,
        pollAttempts: 2,
        pollIntervalMs: 1000,
      });
    } catch (e) {
      toast.error(getChatFriendlyError(e, "chat.onsite-quote.create"));
    } finally {
      setOnsiteSubmitting(false);
    }
  }

  const quoteDialog = (
    <QuoteComposerDialog
      open={quoteOpen}
      onOpenChange={setQuoteOpen}
      conversationId={conversationId}
      dialogTitle="Cotización"
      dialogDescription="Completa los detalles y envía la cotización al cliente."
      onSubmitted={(info) => {
        // Optimistic quote message so el profesional lo ve al instante (el cliente recibe realtime)
        if (viewerRole === "professional") {
          const createdAtIso = new Date().toISOString();
          const optimistic: Msg = {
            id:
              info?.id && typeof info.id === "string"
                ? info.id
                : `tmp_quote_${Date.now()}`,
            senderId: meId ?? "me",
            body: "Cotización enviada",
            createdAt: createdAtIso,
            messageType: "quote",
            payload: {
              quote_id:
                info?.id && typeof info.id === "string"
                  ? info.id
                  : `tmp_quote_${Date.now()}`,
              total:
                typeof info?.total === "number" && Number.isFinite(info.total)
                  ? info.total
                  : null,
              currency:
                typeof info?.currency === "string" &&
                info.currency.trim().length
                  ? info.currency
                  : "MXN",
            },
            attachments: [],
          };
          mergeMessages(optimistic, { fromServer: true });
        }
        scheduleConversationResync("quote-submitted", {
          delayMs: 180,
          pollAttempts: 4,
          pollIntervalMs: 1000,
        });
        void load(false, { silent: true });
      }}
    />
  );

  const onsiteDialog = (
    <Dialog open={onsiteOpen} onOpenChange={setOnsiteOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cotizar en sitio</DialogTitle>
          <DialogDescription>
            Envía una solicitud de cotización en sitio para que el cliente la
            acepte y pague desde el chat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Concepto
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm bg-slate-50 text-slate-600"
              value="Cotización en sitio"
              readOnly
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Precio</label>
            <div className="relative">
              <input
                type="number"
                min={1}
                step="1"
                className="w-full border rounded px-3 py-2 pr-14 text-sm"
                value={onsiteAmount}
                onChange={(event) => setOnsiteAmount(event.target.value)}
                placeholder="Monto"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-500">
                MXN
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Detalles y condiciones
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              rows={3}
              value={onsiteDetails}
              onChange={(event) => setOnsiteDetails(event.target.value)}
            />
          </div>
          <div className="flex items-start gap-2 rounded-md border bg-slate-50 px-3 py-2">
            <input
              id="onsite-remunerable"
              type="checkbox"
              className="mt-1 size-4"
              checked={onsiteRemunerable}
              onChange={(event) => setOnsiteRemunerable(event.target.checked)}
            />
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-slate-700">
              <label
                htmlFor="onsite-remunerable"
                className="cursor-pointer select-none"
              >
                Remunerable al solicitar servicio
              </label>
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-4 items-center justify-center text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-sm"
                      aria-label="Información sobre remuneración"
                    >
                      <CircleHelp className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="z-[80] max-w-xs leading-5"
                  >
                    Si activas esta opción, el monto pagado por la cotización en
                    sitio se tomará en cuenta al contratar el servicio final a
                    través de Handi. Es decir, ese monto se descontará del costo
                    del servicio una vez cotizado. Si no se contrata el
                    servicio, este pago no se reembolsa y cubre la visita de
                    valoración en sitio.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOnsiteOpen(false)}
            disabled={onsiteSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void submitOnsite()}
            disabled={onsiteSubmitting}
          >
            {onsiteSubmitting ? "Enviando..." : "Solicitar"}
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
            Estas seguro de rechazar este trabajo? Si es asi notifica al cliente
            tus requerimientos.
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
      <div className="flex h-full flex-col overflow-hidden">
        {showSafetyTip ? (
          <div
            className={[
              "border-b p-3 bg-[#fbfbfb]",
              "transition-opacity",
              "duration-200",
              safetyClosing ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Evita compartir datos personales
              </div>
              <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={() => {
                  setSafetyClosing(true);
                  setTimeout(() => {
                    setShowSafetyTip(false);
                    setSafetyClosing(false);
                  }, 200);
                }}
                className="inline-flex items-center justify-center h-5 w-5 rounded-full border text-slate-500 hover:bg-neutral-100"
                title="Cerrar"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {/* min-h-0 + shrink-0 keep list scrollable and the action bar compact */}
          <div className="flex flex-1 min-h-0 flex-col">
            {loadingState || messageList}
            {typingIndicator}
          </div>
          {actionButtons}
          <div className="border-t p-2 shrink-0">
            <ChatUploader
              conversationId={conversationId}
              mode="draft-first"
              showButton={false}
              onReady={(api) => {
                uploaderApiRef.current = api;
              }}
              onMessageCreated={({ messageId, attachments }) => {
                if (process.env.NODE_ENV !== "production") {
                  // eslint-disable-next-line no-console
                  console.debug(
                    "ui att add optimistic",
                    messageId,
                    attachments.length,
                  );
                }
                setMessages((prev) => {
                  const exists = prev.some((m) => m.id === messageId);
                  let next = prev;
                  if (!exists) {
                    const createdAtIso = new Date().toISOString();
                    next = [
                      ...prev,
                      {
                        id: messageId,
                        senderId: meId ?? "me",
                        body: "",
                        createdAt: createdAtIso,
                        messageType: "text",
                        payload: null,
                        attachments: [],
                      },
                    ];
                  }
                  const converted = attachments.map((a) => ({
                    id: (a as any)?.id as string | undefined,
                    filename: a.filename,
                    mime_type: a.mime_type,
                    byte_size: a.byte_size,
                    width: a.width ?? null,
                    height: a.height ?? null,
                    storage_path: a.storage_path,
                    created_at: (a as any)?.created_at as string | undefined,
                  }));
                  for (const att of converted) {
                    next = appendAttachment(next, messageId, att);
                  }
                  return next;
                });
                scheduleConversationResync("attachment-created", {
                  delayMs: 220,
                  pollAttempts: 3,
                  pollIntervalMs: 900,
                });
              }}
            />
          </div>
          <div className="shrink-0">
            <MessageInput
              onSend={onSend}
              onTyping={emitTyping}
              disabled={loading}
              initialText={composerPrefillText}
              allowContact={allowContact}
              dataPrefix={dataPrefix}
              onPickFiles={() => uploaderApiRef.current?.pickFiles()}
              onPickCamera={() => uploaderApiRef.current?.pickCamera()}
              onFocus={() => {
                try {
                  const el = document.querySelector(
                    `[data-testid="${dataPrefix}-list"]`,
                  ) as HTMLDivElement | null;
                  if (el)
                    setTimeout(
                      () =>
                        el.scrollTo({
                          top: el.scrollHeight,
                          behavior: "smooth",
                        }),
                      50,
                    );
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>
        </div>
        {acceptedForPay ? (
          <OfferPaymentDialog
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
            offerId={acceptedForPay.offerId}
            amount={typeof feeAmount === "number" ? feeAmount : 0}
            currency={feeCurrency || "MXN"}
            title={acceptedForPay.title || "Pago seguro"}
            onSuccess={handlePaymentSuccess}
          />
        ) : null}
        {offerDialog}
        {quoteDialog}
        {onsiteDialog}
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
      <SheetContent
        side="right"
        hideClose
        className="p-0 h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] rounded-none overflow-hidden left-0 right-0 sm:left-auto sm:max-w-md sm:w-auto sm:rounded-l-xl"
        data-testid={`${dataPrefix}-box`}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Chat</SheetTitle>
        </SheetHeader>
        <div className="flex h-full w-full flex-col overflow-hidden">
          {statusHeader}
          {showSafetyTip ? (
            <div
              className={[
                "border-b p-3 bg-[#fbfbfb]",
                "transition-opacity",
                "duration-200",
                safetyClosing ? "opacity-0" : "opacity-100",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Evita compartir datos personales
                </div>
                {(mode as "panel" | "page") === "page" ? (
                  <button
                    type="button"
                    aria-label="Cerrar aviso"
                    onClick={() => {
                      setSafetyClosing(true);
                      setTimeout(() => {
                        setShowSafetyTip(false);
                        setSafetyClosing(false);
                      }, 200);
                    }}
                    className="inline-flex items-center justify-center h-5 w-5 rounded-full border text-slate-500 hover:bg-neutral-100"
                    title="Cerrar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {loadingState || (
            <>
              <div className="flex flex-1 min-h-0 flex-col">
                {messageList}
                {typingIndicator}
              </div>
              {/* Stage-aware actions: include default CTAs and in-process controls */}
              {(() => {
                const st = (requestStatus || "").toLowerCase();
                const isScheduled = st === "scheduled";
                const isInProcess = st === "in_process" || st === "inprogress";
                const proActions =
                  participants && meId === participants?.pro_id;
                const canStart = proActions && isScheduled;
                const canFinish =
                  proActions && (isScheduled || isInProcess) && !!requestId;
                return (
                  <>
                    {actionButtons}
                    {canStart || canFinish ? (
                      <div className="p-3 flex items-center gap-2 border-t">
                        {canStart ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              void patchRequestStatus("in_process");
                            }}
                          >
                            Empezar trabajo
                          </Button>
                        ) : null}
                        {canFinish ? (
                          <FinishJobTrigger
                            requestId={requestId ?? ""}
                            requestTitle={requestTitle}
                            requestStatus={requestStatus}
                            clientId={participants?.customer_id ?? null}
                            proId={participants?.pro_id ?? null}
                            buttonLabel="Trabajo finalizado"
                            buttonClassName="bg-brand text-white hover:opacity-90"
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </>
          )}
          <div className="border-t p-2 shrink-0">
            <ChatUploader
              conversationId={conversationId}
              mode="draft-first"
              showButton={false}
              onReady={(api) => {
                uploaderApiRef.current = api;
              }}
              onMessageCreated={({ messageId, attachments }) => {
                if (process.env.NODE_ENV !== "production") {
                  // eslint-disable-next-line no-console
                  console.debug(
                    "ui att add optimistic",
                    messageId,
                    attachments.length,
                  );
                }
                setMessages((prev) => {
                  const exists = prev.some((m) => m.id === messageId);
                  let next = prev;
                  if (!exists) {
                    const createdAtIso = new Date().toISOString();
                    next = [
                      ...prev,
                      {
                        id: messageId,
                        senderId: meId ?? "me",
                        body: "",
                        createdAt: createdAtIso,
                        messageType: "text",
                        payload: null,
                        attachments: [],
                      },
                    ];
                  }
                  const converted = attachments.map((a) => ({
                    id: (a as any)?.id as string | undefined,
                    filename: a.filename,
                    mime_type: a.mime_type,
                    byte_size: a.byte_size,
                    width: a.width ?? null,
                    height: a.height ?? null,
                    storage_path: a.storage_path,
                    created_at: (a as any)?.created_at as string | undefined,
                  }));
                  for (const att of converted) {
                    next = appendAttachment(next, messageId, att);
                  }
                  return next;
                });
                scheduleConversationResync("attachment-created", {
                  delayMs: 220,
                  pollAttempts: 3,
                  pollIntervalMs: 900,
                });
              }}
            />
          </div>
          <div className="shrink-0">
            <MessageInput
              onSend={onSend}
              onTyping={emitTyping}
              disabled={loading}
              initialText={composerPrefillText}
              allowContact={allowContact}
              dataPrefix={dataPrefix}
              onPickFiles={() => uploaderApiRef.current?.pickFiles()}
              onPickCamera={() => uploaderApiRef.current?.pickCamera()}
              onFocus={() => {
                try {
                  const el = document.querySelector(
                    `[data-testid="${dataPrefix}-list"]`,
                  ) as HTMLDivElement | null;
                  if (el)
                    setTimeout(
                      () =>
                        el.scrollTo({
                          top: el.scrollHeight,
                          behavior: "smooth",
                        }),
                      50,
                    );
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>
          {/* Fee dialog visible for customer to confirm breakdown before checkout */}
          {acceptedForPay ? (
            <OfferPaymentDialog
              open={paymentOpen}
              onOpenChange={setPaymentOpen}
              offerId={acceptedForPay.offerId}
              amount={typeof feeAmount === "number" ? feeAmount : 0}
              currency={feeCurrency || "MXN"}
              title={acceptedForPay.title || "Pago seguro"}
              onSuccess={handlePaymentSuccess}
            />
          ) : null}
          {offerDialog}
          {quoteDialog}
          {onsiteDialog}
          {dialog}
        </div>
      </SheetContent>
    </Sheet>
  );
}
