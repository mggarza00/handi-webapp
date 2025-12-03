"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttachmentList } from "@/app/(app)/messages/_components/AttachmentList";
import LocationCard, { type LocationPayload } from "@/components/chat/LocationCard";
import AcceptOfferButton from "@/app/(app)/offers/_components/AcceptOfferButton";
import { extractOfferId, extractStatus, extractProIds, extractViewerIds, isOwnerPro } from "@/lib/offers/actors";
import ClientFeeDialog from "@/components/payments/ClientFeeDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Item = {
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

type MessageListProps = {
  items: Item[];
  conversationId?: string | null;
  currentUserId?: string | null;
  otherUserId?: string | null;
  viewerRole?: "customer" | "professional" | "guest";
  onAcceptOffer?: (offerId: string) => void;
  onOfferAcceptedUI?: (offerId: string, opts?: { checkoutUrl?: string | null }) => void;
  onRejectOffer?: (offerId: string) => void;
  actionOfferId?: string | null;
  dataPrefix?: string; // e2e: chat | request-chat
  onOpenOfferDialog?: (opts: { amount?: number | null; currency?: string | null }) => void;
};

type OfferState = {
  offerId: string;
  title: string | null;
  description: string | null;
  amount: number | null;
  currency: string;
  serviceDate: string | null;
  status: string;
  checkoutUrl: string | null;
  reason: string | null;
  messageId: string;
  lastUpdate: string;
};

type QuotePayload = {
  quote_id?: string | null;
  total?: number | string | null;
  currency?: string | null;
};

type SystemMessagePayload = LocationPayload & {
  status?: string | null;
  reason?: string | null;
  receipt_url?: string | null;
  receipt_id?: string | null;
  download_url?: string | null;
  quote_id?: string | null;
  total?: number | string | null;
  currency?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

function formatRelative(ts: string): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 5) return "ahora";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

function formatOfferDate(raw?: string | null): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${day}-${month}-${year}`;
}

function formatCurrency(amount: number | null, currency: string): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

// Use shared helpers from lib/offers/actors

export default function MessageList({
  items,
  conversationId,
  currentUserId,
  otherUserId,
  viewerRole = "guest",
  onAcceptOffer: _onAcceptOffer,
  onOfferAcceptedUI,
  onRejectOffer: _onRejectOffer,
  actionOfferId,
  dataPrefix = "chat",
  onOpenOfferDialog,
}: MessageListProps) {
  const bgStyle = React.useMemo<React.CSSProperties>(() => ({
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.6), rgba(255,255,255,0.6)), url(/images/homaid-tools-and-hardware-pattern.png)",
    backgroundRepeat: "repeat",
    backgroundPosition: "top left",
    backgroundSize: "400px",
  }), []);
  const searchParams = useSearchParams();
  const debugActions = searchParams?.get('debugActions') === '1';
  // legacy inline pay flow moved to top bar (ChatPanel)
  const [/* payingOfferId */, setPayingOfferId] = React.useState<string | null>(null);
  const [feeOpen, setFeeOpen] = React.useState(false);
  const [quoteLightbox, setQuoteLightbox] = React.useState<string | null>(null);
  const [quoteImgLoading, setQuoteImgLoading] = React.useState(false);
  React.useEffect(() => {
    if (quoteLightbox) setQuoteImgLoading(true);
    else setQuoteImgLoading(false);
  }, [quoteLightbox]);
  const [feeCtx, setFeeCtx] = React.useState<{ offerId: string; amount: number | null; currency: string; checkoutUrl?: string | null }>({ offerId: "", amount: null, currency: "MXN", checkoutUrl: null });
  const handlePay = React.useCallback(async (offerId: string, existingUrl?: string | null) => {
    let url = typeof existingUrl === "string" && existingUrl.trim().length ? existingUrl : null;
    try {
      setPayingOfferId(offerId);
      if (!url) {
        const res = await fetch(`/api/offers/${encodeURIComponent(offerId)}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          credentials: "include",
        });
        const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (res.ok) {
          const checkoutUrl = parsed.checkoutUrl;
          const offerRecord = (parsed.offer ?? null) as Record<string, unknown> | null;
          const nestedUrl = offerRecord && typeof offerRecord["checkout_url"] === "string" ? offerRecord["checkout_url"] : null;
          url = (typeof checkoutUrl === "string" && checkoutUrl) || nestedUrl || null;
        }
      }
      if (url) {
        window.location.assign(url);
      }
    } finally {
      setPayingOfferId(null);
    }
  }, []);
  const ref = React.useRef<HTMLDivElement | null>(null);
  // Auto-scroll: ensure last message is visible on mount and when new items arrive
  const lastKey = items.length ? `${items[items.length - 1]?.id}-${items[items.length - 1]?.createdAt}` : "";
  const lastKeyRef = React.useRef<string>("");
  const scrollToBottom = React.useCallback((smooth = false) => {
    const el = ref.current;
    if (!el) return;
    try {
      const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
      el.scrollTo({ top: el.scrollHeight, behavior });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  }, []);
  React.useEffect(() => {
    // On first mount, jump to bottom
    if (!lastKeyRef.current) {
      scrollToBottom(false);
      lastKeyRef.current = lastKey;
      return;
    }
    const el = ref.current;
    if (!el) return;
    // If user is near bottom or a new message arrived, keep anchored to bottom
    const threshold = 200; // px
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= threshold;
    const changed = lastKeyRef.current !== lastKey && lastKey.length > 0;
    if (nearBottom) scrollToBottom(changed); // keep anchored when user is near bottom
    lastKeyRef.current = lastKey;
  }, [lastKey, scrollToBottom]);
  React.useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  const offerStates = React.useMemo(() => {
    const map = new Map<string, OfferState>();
    for (const message of items) {
      const payload = message.payload;
      if (!payload || typeof payload !== "object") continue;

      const payloadRecord = payload as Record<string, unknown>;
      const offerIdRaw = payloadRecord["offer_id"];
      if (typeof offerIdRaw !== "string" || offerIdRaw.trim().length === 0) continue;

      const offerId = offerIdRaw;
      const state =
        map.get(offerId) ?? {
          offerId,
          title: null,
          description: null,
          amount: null,
          currency: "MXN",
          serviceDate: null,
          status: "pending",
          checkoutUrl: null,
          reason: null,
          messageId: message.id,
          lastUpdate: message.createdAt,
        };

      if (message.messageType === "offer") {
        const rawTitle = payloadRecord["title"];
        if (typeof rawTitle === "string" && rawTitle.trim().length) state.title = rawTitle;

        const rawDescription = payloadRecord["description"];
        if (typeof rawDescription === "string" && rawDescription.length) state.description = rawDescription;

        const amountRaw = payloadRecord["amount"];
        const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw ?? NaN);
        state.amount = Number.isFinite(amount) ? amount : state.amount;

        const currencyRaw = payloadRecord["currency"];
        if (typeof currencyRaw === "string" && currencyRaw.trim().length) {
          state.currency = currencyRaw.toUpperCase();
        }

        const serviceDateRaw = payloadRecord["service_date"];
        if (typeof serviceDateRaw === "string" && serviceDateRaw.trim().length) {
          state.serviceDate = serviceDateRaw;
        }

        const statusRaw = payloadRecord["status"];
        if (typeof statusRaw === "string") state.status = extractStatus(statusRaw);

        const checkoutUrlRaw = payloadRecord["checkout_url"];
        if (typeof checkoutUrlRaw === "string" && checkoutUrlRaw.length) state.checkoutUrl = checkoutUrlRaw;

        const reasonRaw = payloadRecord["reason"];
        if (typeof reasonRaw === "string" && reasonRaw.length) state.reason = reasonRaw;
      } else if (message.messageType === "system") {
        const statusRaw = payloadRecord["status"];
        if (typeof statusRaw === "string") state.status = extractStatus(statusRaw);

        const checkoutUrlRaw = payloadRecord["checkout_url"];
        if (typeof checkoutUrlRaw === "string" && checkoutUrlRaw.length) state.checkoutUrl = checkoutUrlRaw;

        const reasonRaw = payloadRecord["reason"];
        if (typeof reasonRaw === "string" && reasonRaw.length) state.reason = reasonRaw;
      }

      state.lastUpdate = message.createdAt;
      state.messageId = message.id;
      map.set(offerId, state);
    }
    return map;
  }, [items]);

  if (!items.length)
    return (
      <div
        ref={ref}
        className="flex-1 overflow-y-auto overscroll-contain p-3"
        style={bgStyle}
        data-testid={`${dataPrefix}-list`}
      >
        <div className="w-full max-w-xl mx-auto text-center py-10 space-y-4">
          {viewerRole === "customer" ? (
            <div className="space-y-2" data-testid={`${dataPrefix}-empty-state-customer`}>
              <div className="flex items-center justify-center gap-2">
                <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Cotiza</Badge>
                <span className="text-primary">&gt;</span>
                <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Contrata</Badge>
                <span className="text-primary">&gt;</span>
                <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Paga</Badge>
              </div>
              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-black border-emerald-100 shadow-sm whitespace-normal break-words overflow-visible max-w-[90%] sm:max-w-[70%] text-center !py-1"
                >
                  Protegemos tu pago hasta que apruebes el servicio finalizado.
                </Badge>
              </div>
            </div>
          ) : viewerRole === "professional" ? (
            <div className="space-y-2" data-testid={`${dataPrefix}-empty-state-professional`}>
              <div className="flex items-center justify-center gap-2">
                <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Cotiza</Badge>
                <span className="text-primary">&gt;</span>
                <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Acepta Oferta</Badge>
                <span className="text-primary">&gt;</span>
                <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Agenda Servicio</Badge>
              </div>
              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className="bg-white text-black border-slate-200 shadow-sm whitespace-normal break-words overflow-visible max-w-[90%] sm:max-w-[70%] text-center !py-1"
                >
                  Los servicios agendados se agregan a tu calendario en automático.
                </Badge>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );

  function renderOffer(message: Item) {
    const payload = message.payload || {};
    const baseOfferId = typeof payload.offer_id === "string" ? payload.offer_id : null;
    if (!baseOfferId) return <div>{message.body}</div>;
    const state = offerStates.get(baseOfferId) ?? {
      offerId: baseOfferId,
      title: typeof payload.title === "string" ? payload.title : null,
      description: typeof payload.description === "string" ? payload.description : null,
      amount: typeof payload.amount === "number" ? payload.amount : Number(payload.amount ?? NaN),
      currency: typeof payload.currency === "string" ? payload.currency : "MXN",
      serviceDate: typeof payload.service_date === "string" ? payload.service_date : null,
      status: typeof payload.status === "string" ? payload.status : "pending",
      checkoutUrl: typeof payload.checkout_url === "string" ? payload.checkout_url : null,
      reason: typeof payload.reason === "string" ? payload.reason : null,
      messageId: message.id,
      lastUpdate: message.createdAt,
    };
    const offerObj = message.payload || {};
    const offerObjRecord = offerObj as Record<string, unknown>;
    const resolvedOfferId = extractOfferId(offerObj) ?? (typeof offerObjRecord.id === 'string' ? (offerObjRecord.id as string) : state.offerId);
    const status = extractStatus(state.status);
    const isPending = status === 'pending';
    const proIds = extractProIds(offerObj);
    const viewer = currentUserId ? { id: currentUserId } : null;
    const g = globalThis as unknown as { __sessionUser?: unknown };
    const sessionUser = g.__sessionUser as unknown;
    const viewerIds = extractViewerIds(viewer ?? undefined, sessionUser);
    const ownerOK = isOwnerPro(offerObj, viewer ?? undefined, sessionUser);
    const pendingOK = isPending;
    let canAct = (viewerRole === 'professional') && isPending;
    if (!canAct && viewerRole === 'professional' && proIds.length === 0 && viewer && isPending) {
      canAct = true;
    }
    const formattedAmount = formatCurrency(state.amount, state.currency || "MXN") ?? message.body;
    const formattedDate = formatOfferDate(state.serviceDate);
    const offerId = resolvedOfferId;
    const disableActions = actionOfferId === offerId;
    const disabled = Boolean(disableActions);
    const showPayCta = false; // mover CTA de pago al top bar del chat (ChatPanel)
    const statusLabelMap: Record<string, string> = {
      pending: "Enviada",
      accepted: "Aceptada",
      rejected: "Rechazada",
      canceled: "Cancelada",
      expired: "Expirada",
      paid: "Pagada",
    };
    const badgeTone = (() => {
      switch (status) {
        case "accepted":
          return "bg-emerald-100 text-emerald-700";
        case "rejected":
          return "bg-rose-100 text-rose-700";
        case "paid":
          return "bg-blue-100 text-blue-700";
        case "canceled":
        case "expired":
          return "bg-slate-200 text-slate-700";
        default:
          return "bg-slate-100 text-slate-700";
      }
    })();

    const showActions = canAct || debugActions;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[offer-actions]', {
        offerId: resolvedOfferId,
        status,
        proIds,
        viewerIds,
        ownerOK,
        pendingOK,
        canAct,
        disabled,
        debugActions,
      });
    }

    return (
      <div className="space-y-2">
        <div>
          <div className="text-[13px] font-medium">Oferta de contratacion</div>
          {state.title ? <div className="text-sm font-semibold text-slate-800">{state.title}</div> : null}
        </div>
        <div className="text-sm text-slate-700">
          {formattedAmount ? <div>Monto: {formattedAmount}</div> : null}
          {formattedDate ? <div>Dia: {formattedDate}</div> : null}
          {state.description ? <div className="whitespace-pre-wrap text-slate-600">{state.description}</div> : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Badge className={badgeTone}>{statusLabelMap[status] || status}</Badge>
        </div>
        {showActions ? (
          <div className="flex gap-2 pt-1" data-testid="offer-actions-pro">
            <AcceptOfferButton
              offerId={offerId}
              conversationId={conversationId ?? undefined}
              onAccepted={(opts) => { onOfferAcceptedUI?.(offerId, { checkoutUrl: opts?.checkoutUrl ?? null }); }}
              className="text-xs"
              disabled={disabled}
              data-testid="accept-offer"
            >
              {disabled ? "Procesando..." : "Aceptar"}
            </AcceptOfferButton>

            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (_onRejectOffer) {
                  _onRejectOffer(offerId);
                  return;
                }
                // Fallback minimal (sin modal) si no se pasa handler desde el contenedor
                try {
                  const res = await fetch(`/api/offers/${offerId}/reject`, { method: "POST", credentials: 'include', headers: { 'Content-Type': 'application/json; charset=utf-8' } });
                  if (!res.ok) {
                    const j = await res.json().catch(() => ({} as Record<string, unknown>));
                    throw new Error((j as Record<string, unknown>)?.error as string || "No se pudo rechazar la oferta");
                  }
                } catch (e) {
                  // eslint-disable-next-line no-console
                  console.error(e);
                  alert("Hubo un problema al rechazar la oferta");
                }
              }}
              disabled={disabled}
              data-testid="reject-offer"
              className="text-xs"
            >
              Rechazar
            </Button>
            {debugActions && !canAct ? (
              <span className="text-[10px] text-muted-foreground">
                (debug: ownerOK={String(ownerOK)}, pendingOK={String(pendingOK)})
              </span>
            ) : null}
          </div>
        ) : null}
        {showPayCta ? (
          <div className="pt-1">
            <Button size="sm" onClick={() => { setFeeCtx({ offerId: resolvedOfferId, amount: state.amount, currency: state.currency || "MXN", checkoutUrl: state.checkoutUrl }); setFeeOpen(true); }}>
              Pagar ahora
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderBody(message: Item) {
    if (message.messageType === "offer") {
      return renderOffer(message);
    }
    if (message.messageType === "quote" && message.payload && typeof message.payload === "object") {
      const payloadRecord = message.payload as QuotePayload;
      const qid = typeof payloadRecord.quote_id === "string" ? payloadRecord.quote_id : null;
      const totalRaw = payloadRecord.total;
      const currencyRaw = payloadRecord.currency;
      const total = typeof totalRaw === "number" ? totalRaw : Number(totalRaw ?? NaN);
      const currency = typeof currencyRaw === "string" ? currencyRaw : "MXN";
      const totalFmt = Number.isFinite(total) ? formatCurrency(total, currency || "MXN") : null;
      const hasAttachment = Array.isArray(message.attachments) && message.attachments.length > 0;
      return (
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-800">Cotización enviada</div>
          {totalFmt ? <div className="text-sm text-slate-700">Total: {totalFmt}</div> : null}
          {/* Fallback: si aún no hay adjunto, muestra la imagen renderizada por API */}
          {!hasAttachment && qid ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setQuoteLightbox(`/api/quotes/${encodeURIComponent(qid)}/image`)}
                className="block overflow-hidden rounded-md border hover:opacity-90"
                aria-label="Abrir cotización"
                title="Abrir cotización"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/quotes/${encodeURIComponent(qid)}/image`}
                  alt="Cotización"
                  className="block max-h-56 object-contain"
                  style={{ maxWidth: 300 }}
                />
              </button>
            </div>
          ) : null}
        </div>
      );
    }
    if (message.messageType === "system" && message.payload && typeof message.payload === "object") {
      const payloadRecord = message.payload as SystemMessagePayload;
      // LocationCard: type 'system/location' o 'schedule_details'
      const payloadType = typeof payloadRecord.type === "string" ? payloadRecord.type : "";
      const hasLocationFlat =
        typeof payloadRecord.map_image_url === "string" ||
        typeof payloadRecord.maps_url === "string" ||
        typeof payloadRecord.address_line === "string";
      const nested = payloadRecord.location && typeof payloadRecord.location === "object" ? payloadRecord.location : null;
      const hasLocationNested =
        !!nested &&
        (typeof nested.map_image_url === "string" ||
          typeof nested.maps_url === "string" ||
          typeof nested.address_line === "string");
      if (payloadType === "system/location" || payloadType === "schedule_details" || hasLocationFlat || hasLocationNested) {
        return <LocationCard payload={payloadRecord} />;
      }
      const statusValue = typeof payloadRecord.status === "string" ? payloadRecord.status : undefined;
      const status = extractStatus(statusValue);
      const reasonValue = typeof payloadRecord.reason === "string" ? payloadRecord.reason : null;
      if (reasonValue && status === "rejected") {
        return (
          <div>
            <div className="font-medium text-sm">Oferta rechazada</div>
            <div className="text-xs text-slate-600">Motivo: {reasonValue}</div>
          </div>
        );
      }
      if (status === "accepted") {
        return (
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-emerald-700">Oferta aceptada</div>
          </div>
        );
      }
      if (status === "paid") {
        const receiptUrl = typeof payloadRecord.receipt_url === 'string' && payloadRecord.receipt_url.trim().length ? (payloadRecord.receipt_url as string) : null;
        return (
          <div className="text-sm font-medium text-blue-700">
            Pago realizado. Servicio agendado.
            {receiptUrl ? (
              <>
                {" "}
                <a href={receiptUrl} target="_blank" rel="noreferrer" className="underline text-blue-700 hover:text-blue-800">Ver recibo</a>
              </>
            ) : null}
          </div>
        );
      }
      if (status === "receipt") {
        const rid = typeof payloadRecord.receipt_id === 'string' ? (payloadRecord.receipt_id as string) : null;
        const dl = typeof payloadRecord.download_url === 'string' && payloadRecord.download_url.trim().length
          ? (payloadRecord.download_url as string)
          : (rid ? `/api/receipts/${encodeURIComponent(rid)}/pdf` : null);
        const link = dl || (typeof payloadRecord.receipt_url === 'string' ? (payloadRecord.receipt_url as string) : null);
        return (
          <div className="text-sm text-slate-800">
            {message.body}
            {Array.isArray(message.attachments) && message.attachments.length > 0 ? null : (
              link ? (
                <>
                  {" "}
                  <a href={link} target="_blank" rel="noreferrer" className="underline text-blue-700 hover:text-blue-800">Descargar PDF</a>
                </>
              ) : null
            )}
          </div>
        );
      }
    }
    return <div>{message.body}</div>;
  }

  return (
    <div
      ref={ref}
      className="flex-1 overflow-y-auto overscroll-contain p-3"
      style={bgStyle}
      data-testid={`${dataPrefix}-list`}
    >
      {viewerRole === "customer" ? (
        <div className="w-full max-w-xl mx-auto text-center py-4 space-y-2" data-testid={`${dataPrefix}-conversation-header-customer`}>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Cotiza</Badge>
            <span className="text-primary">&gt;</span>
            <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Contrata</Badge>
            <span className="text-primary">&gt;</span>
            <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Paga</Badge>
          </div>
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className="bg-emerald-50 text-black border-emerald-100 shadow-sm whitespace-normal break-words overflow-visible max-w-[90%] sm:max-w-[70%] text-center !py-1"
            >
              Protegemos tu pago hasta que apruebes el servicio finalizado.
            </Badge>
          </div>
        </div>
      ) : viewerRole === "professional" ? (
        <div className="w-full max-w-xl mx-auto text-center py-4 space-y-2" data-testid={`${dataPrefix}-conversation-header-professional`}>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Cotiza</Badge>
            <span className="text-primary">&gt;</span>
            <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Acepta Oferta</Badge>
            <span className="text-primary">&gt;</span>
            <Badge variant="outline" className="bg-white text-primary border-slate-200 shadow-sm">Agenda Servicio</Badge>
          </div>
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className="bg-white text-black border-slate-200 shadow-sm whitespace-normal break-words overflow-visible max-w-[90%] sm:max-w-[70%] text-center !py-1"
            >
              Los servicios agendados se agregan a tu calendario en automático.
            </Badge>
          </div>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items.map((m) => {
          const isMe = currentUserId && (m.senderId === currentUserId || m.senderId === "me");
          const isRead = isMe && otherUserId ? (m.readBy ?? []).includes(otherUserId) : false;
          const author = viewerRole === "customer" ? (isMe ? "client" : "pro") : viewerRole === "professional" ? (isMe ? "pro" : "client") : "unknown";
          return (
            <li
              key={m.id}
              className={`text-sm flex ${isMe ? "justify-end" : "justify-start"}`}
              data-testid={`${dataPrefix}-message`}
              data-author={author}
              data-message-id={m.id}
            >
              <div
                className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 shadow-sm ${
                  isMe ? "bg-blue-50" : "bg-slate-100"
                }`}
              >
                <div title={new Date(m.createdAt).toLocaleString()} className="text-[11px] text-slate-500 mb-1">
                  {formatRelative(m.createdAt)}
                </div>
                {(() => {
                  if (m.messageType === 'quote' && m.payload && typeof m.payload === 'object') {
                    // Reuse unified quote body (text + link). Attachments render below.
                    return renderBody(m);
                  }
                  return renderBody(m);
                })()}
        {Array.isArray(m.attachments) && m.attachments.length > 0 ? (
          <div className="mt-2">
            <AttachmentList
              items={m.attachments}
              resolveLightboxUrl={(_att, url) => {
                const payload = isRecord(m.payload) ? (m.payload as QuotePayload) : null;
                const qid = typeof payload?.quote_id === "string" ? payload.quote_id : null;
                if (m.messageType === 'quote' && qid) {
                  return `/api/quotes/${encodeURIComponent(qid)}/image`;
                }
                return url;
              }}
            />
          </div>
        ) : null}
        {(() => {
          if (m.messageType !== 'quote' || viewerRole !== 'customer') return null;
          const payload = isRecord(m.payload) ? (m.payload as QuotePayload) : null;
          const totalRaw = payload?.total ?? null;
          const currencyRaw = payload?.currency ?? null;
          const total = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw ?? NaN);
          const currency = typeof currencyRaw === 'string' ? currencyRaw : 'MXN';
          if (!Number.isFinite(total)) return null;
          return (
            <div className="mt-2 flex justify-center">
              <Button size="sm" onClick={() => onOpenOfferDialog?.({ amount: total, currency })}>
                Contratar
              </Button>
            </div>
          );
        })()}
        {isMe ? (
          <div className="mt-1 text-[11px] text-slate-400 text-right">
            {isRead ? "Leido" : "Enviado"}
          </div>
        ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={!!quoteLightbox} onOpenChange={(o) => { if (!o) setQuoteLightbox(null); }}>
        <DialogContent showCloseButton={false} className="max-w-3xl p-0 sm:p-0 border-0 shadow-none bg-transparent">
          {quoteLightbox ? (
            <div className="relative" aria-busy={quoteImgLoading}>
              {quoteImgLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="size-8 animate-spin rounded-full border-2 border-white/70 border-t-transparent" aria-label="Cargando" />
                </div>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={quoteLightbox}
                alt="Cotización"
                className="h-auto w-full rounded object-contain"
                onLoad={() => setQuoteImgLoading(false)}
                onError={() => setQuoteImgLoading(false)}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ClientFeeDialog
        open={feeOpen}
        onOpenChange={setFeeOpen}
        amount={feeCtx.amount ?? 0}
        currency={feeCtx.currency}
        confirmLabel="Continuar al pago"
        onConfirm={() => {
          setFeeOpen(false);
          void handlePay(feeCtx.offerId, feeCtx.checkoutUrl ?? null);
        }}
      />
    </div>
  );
}
