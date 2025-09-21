/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { Button } from "@/components/ui/button";
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
};
type Participants = { customer_id: string; pro_id: string };
type HistoryResponse = {
  ok?: boolean;
  data?: unknown[];
  error?: string;
  participants?: Participants | null;
  request_id?: string | null;
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
  return { id, senderId, body, createdAt, readBy, messageType, payload };
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
  openOfferSignal,
}: {
  conversationId: string;
  onClose: () => void;
  mode?: "panel" | "page";
  userId?: string | null;
  requestId?: string | null;
  requestBudget?: number | null;
  openOfferSignal?: number;
}) {
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
  const [offerSubmitting, setOfferSubmitting] = React.useState(false);
  const [acceptingOfferId, setAcceptingOfferId] = React.useState<string | null>(null);
  const [rejectingOfferId, setRejectingOfferId] = React.useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<string | null>(null);
  const [otherTyping, setOtherTyping] = React.useState(false);
  const channelRef = React.useRef<ReturnType<typeof supabaseBrowser.channel> | null>(null);
  const lastTypingSentRef = React.useRef(0);
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedTokenRef = React.useRef<string | null>(null);
  const syncInFlightRef = React.useRef(false);

  // Abrir diálogo de oferta cuando la señal externa cambie
  const lastOfferSignalRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (typeof openOfferSignal !== "number") return;
    if (lastOfferSignalRef.current === null) {
      lastOfferSignalRef.current = openOfferSignal;
      return;
    }
    if (openOfferSignal !== lastOfferSignalRef.current) {
      lastOfferSignalRef.current = openOfferSignal;
      setOfferDialogOpen(true);
    }
  }, [openOfferSignal]);
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
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabaseAuth.auth.getUser();
        if (!cancelled && data?.user?.id) setMeId(data.user.id);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseAuth, meId]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await parseJsonSafe<{ user?: { id?: string } }>(res);
        if (!cancelled && res.ok && data?.user?.id) setMeId(data.user.id);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
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
        if (cancelled) return;
        const budgetValue = Number((data?.budget as unknown) ?? NaN);
        if (Number.isFinite(budgetValue)) setBudget(budgetValue);
        const reqAt = typeof data?.required_at === "string" ? (data.required_at as string) : null;
        setRequiredAt(reqAt);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, getAuthHeaders]);
  React.useEffect(() => {
    if (!offerDialogOpen) return;
    if (typeof budget === "number" && Number.isFinite(budget)) {
      setOfferAmount((current) => (current ? current : String(budget)));
    }
    if (requiredAt) {
      const parsed = new Date(requiredAt);
      if (!Number.isNaN(parsed.getTime())) {
        setOfferServiceDate((current) => (current ? current : parsed.toISOString().slice(0, 10)));
      }
    }
  }, [offerDialogOpen, budget, requiredAt]);

  React.useEffect(() => {
    if (!conversationId) return;
    const channel = supabaseBrowser
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            body?: string | null;
            text?: string | null;
            created_at: string;
            read_by?: unknown[];
            message_type?: string | null;
            payload?: unknown;
          };
          let parsedPayload: Record<string, unknown> | null = null;
          if (row.payload) {
            if (typeof row.payload === "string" && row.payload.trim().length) {
              try {
                parsedPayload = JSON.parse(row.payload);
              } catch {
                parsedPayload = null;
              }
            } else if (typeof row.payload === "object") {
              parsedPayload = row.payload as Record<string, unknown>;
            }
          }
          const msg: Msg = {
            id: row.id,
            senderId: row.sender_id,
            body: (row.body ?? row.text ?? "").toString(),
            createdAt: row.created_at,
            readBy: Array.isArray(row.read_by)
              ? (row.read_by as unknown[]).map((value) => String(value))
              : [],
            messageType: row.message_type ? String(row.message_type) : "text",
            payload: parsedPayload,
          };
          mergeMessages(msg, { fromServer: true });
        },
      )
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
  const viewerRole = React.useMemo(() => {
    if (!participants || !meId) return "guest" as const;
    if (participants.customer_id === meId) return "customer" as const;
    if (participants.pro_id === meId) return "professional" as const;
    return "guest" as const;
  }, [participants, meId]);
  const offerSummaries = React.useMemo(() => {
    type OfferSummary = {
      offerId: string;
      status: string;
      checkoutUrl: string | null;
      title: string | null;
      amount: number | null;
      currency: string;
    };
    const map = new Map<string, OfferSummary>();
    for (const msg of messagesState) {
      const payload = msg.payload;
      if (!payload || typeof payload !== "object") continue;

      const payloadRecord = payload as Record<string, unknown>;
      const rawId = payloadRecord["offer_id"];
      if (typeof rawId !== "string" || rawId.trim().length === 0) continue;

      const summary =
        map.get(rawId) ?? {
          offerId: rawId,
          status: "sent",
          checkoutUrl: null,
          title: null,
          amount: null,
          currency: "MXN",
        };

      if (msg.messageType === "offer") {
        const rawTitle = payloadRecord["title"];
        if (typeof rawTitle === "string" && rawTitle.trim().length) summary.title = rawTitle;

        const amountRaw = payloadRecord["amount"];
        const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw ?? NaN);
        summary.amount = Number.isFinite(amount) ? amount : summary.amount;

        const currencyRaw = payloadRecord["currency"];
        if (typeof currencyRaw === "string" && currencyRaw.trim().length) {
          summary.currency = currencyRaw.toUpperCase();
        }

        const statusRaw = payloadRecord["status"];
        if (typeof statusRaw === "string") summary.status = normalizeStatus(statusRaw);

        const checkoutUrlRaw = payloadRecord["checkout_url"];
        if (typeof checkoutUrlRaw === "string" && checkoutUrlRaw.length) {
          summary.checkoutUrl = checkoutUrlRaw;
        }
      } else if (msg.messageType === "system") {
        const statusRaw = payloadRecord["status"];
        if (typeof statusRaw === "string") summary.status = normalizeStatus(statusRaw);

        const checkoutUrlRaw = payloadRecord["checkout_url"];
        if (typeof checkoutUrlRaw === "string" && checkoutUrlRaw.length) {
          summary.checkoutUrl = checkoutUrlRaw;
        }
      }

      map.set(rawId, summary);
    }
    return map;
  }, [messagesState]);
  const otherUserId = React.useMemo(() => {
    if (!participants || !meId) return undefined;
    return participants.customer_id === meId ? participants.pro_id : participants.customer_id;
  }, [participants, meId]);
  async function postMessage(body: string, attempt = 0): Promise<{ ok: boolean; error?: string; id?: string | null; createdAt?: string }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/chat/send`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ conversationId, body }),
      });
      const json = await parseJsonSafe<{ ok?: boolean; error?: string; data?: { id?: string; created_at?: string } }>(res);
      const errorText = json?.error || "";
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
        return { ok: false as const, error: AUTH_REQUIRED_MESSAGE };
      }
      if (!res.ok || json?.ok === false) {
        const msg = json?.error || "No se pudo enviar el mensaje";
        if (attempt === 0 && /auth session missing/i.test(msg)) {
          lastSyncedTokenRef.current = null;
          return postMessage(body, attempt + 1);
        }
        return { ok: false as const, error: msg };
      }
      const id = json?.data?.id ? String(json.data.id) : null;
      const createdAt = json?.data?.created_at ? String(json.data.created_at) : new Date().toISOString();
      return { ok: true as const, id, createdAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de red";
      if (attempt === 0 && /auth session missing/i.test(message)) {
        lastSyncedTokenRef.current = null;
        return postMessage(body, attempt + 1);
      }
      if (/auth session missing/i.test(message) || message === "AUTH_REQUIRED" || /invalid_token/i.test(message) || message === "MISSING_AUTH") {
        return { ok: false as const, error: AUTH_REQUIRED_MESSAGE };
      }
      return { ok: false as const, error: message };
    }
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
      const trimmedDescription = offerDescription.trim();
      if (trimmedDescription) payload.description = trimmedDescription;
      if (offerServiceDate) {
        const parsed = new Date(offerServiceDate);
        if (!Number.isNaN(parsed.getTime())) {
          payload.serviceDate = parsed.toISOString();
        }
      }
      const res = await fetch(`/api/conversations/${conversationId}/offers`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await parseJsonSafe<{ error?: string; message?: string }>(res);
        const errorMessage = json?.message || json?.error || "No se pudo crear la oferta";
        throw new Error(errorMessage);
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
  async function handleAcceptOffer(offerId: string) {
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
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/offers/${offerId}/accept`, {
        method: "POST",
        headers,
        credentials: "include",
      });
      const json = await parseJsonSafe<{ ok?: boolean; error?: string; message?: string; checkoutUrl?: string }>(res);
      if (!res.ok || json?.ok === false) {
        const errorMessage = json?.message || json?.error || "No se pudo aceptar la oferta";
        throw new Error(errorMessage);
      }
      toast.success("Oferta aceptada");
      await load(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      toast.error(message);
    } finally {
      setAcceptingOfferId(null);
    }
  }
  async function submitRejectOffer() {
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
      const json = await parseJsonSafe<{ ok?: boolean; error?: string; message?: string }>(res);
      if (!res.ok || json?.ok === false) {
        const errorMessage = json?.message || json?.error || "No se pudo rechazar la oferta";
        throw new Error(errorMessage);
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
    if (!trimmed) return;
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
      return;
    }
    if (result.id) {
      mergeMessages(
        {
          id: result.id,
          senderId: meId ?? "me",
          body: trimmed,
          createdAt: result.createdAt ?? new Date().toISOString(),
          messageType: "text",
          payload: null,
        },
        { fromServer: true },
      );
    }
  }
  const loadingState = loading ? (
    <div className="flex-1 p-3 text-sm text-slate-500" role="status" aria-busy>
      Cargando...
    </div>
  ) : null;
  const actionButtons =
    viewerRole === "customer" ? (
      <div className="p-3 flex items-center justify-end">
        <Button onClick={() => setOfferDialogOpen(true)}>Contratar</Button>
      </div>
    ) : null;
  const typingIndicator = otherTyping ? <TypingIndicator /> : null;
  const messageList = (
    <MessageList
      items={messagesState}
      currentUserId={meId ?? undefined}
      otherUserId={mode === "page" ? otherUserId : undefined}
      viewerRole={viewerRole}
      onAcceptOffer={handleAcceptOffer}
      onRejectOffer={handleOpenReject}
      actionOfferId={acceptingOfferId ?? rejectingOfferId}
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
              className="w-full border rounded px-3 py-2 text-sm"
              value={offerTitle}
              onChange={(event) => setOfferTitle(event.target.value)}
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
                className="w-full border rounded px-3 py-2 text-sm"
                value={offerCurrency}
                onChange={(event) => setOfferCurrency(event.target.value.toUpperCase())}
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
            />
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
          <Button variant="destructive" onClick={() => void submitRejectOffer()} disabled={rejectingOfferId !== null}>
            {rejectingOfferId ? "Procesando..." : "Rechazar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  if (mode === "page") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b p-3 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Conversacion</div>
            <div className="text-xs text-muted-foreground">Evita compartir datos personales</div>
          </div>
          <button
            onClick={onClose}
            className="rounded border px-2 py-1 text-xs hover:bg-neutral-50"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
        {loadingState || messageList}
        {typingIndicator}
        {actionButtons}
        <MessageInput onSend={onSend} onTyping={emitTyping} autoFocus disabled={loading} />
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
      <SheetContent side="right" className="sm:max-w-md p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Chat</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col">
          <div className="border-b p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">Conversacion</div>
              <div className="text-xs text-muted-foreground">Evita compartir datos personales</div>
            </div>
            <button
              onClick={onClose}
              className="rounded border px-2 py-1 text-xs hover:bg-neutral-50"
              aria-label="Cerrar"
            >
              Cerrar
            </button>
          </div>
          {loadingState || (
            <>
              {messageList}
              {typingIndicator}
              {actionButtons}
            </>
          )}
          <MessageInput onSend={onSend} onTyping={emitTyping} autoFocus disabled={loading} />
          {dialog}
        </div>
      </SheetContent>
    </Sheet>
  );
}
