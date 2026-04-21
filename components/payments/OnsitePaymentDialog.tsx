"use client";

import * as React from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import clsx from "clsx";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackEvent } from "@/lib/analytics/track";
import { normalizeAppError } from "@/lib/errors/app-error";
import { reportError } from "@/lib/errors/report-error";

type PaymentMethod = "card" | "paypal";

type OnsitePaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onsiteRequestId: string | null;
  amount: number | null;
  currency?: string;
  isRemunerable?: boolean;
  onSuccess?: () => void;
};

type IntentState = {
  loading: boolean;
  clientSecret: string | null;
  publishableKey: string | null;
  paymentMode: "test" | "live" | null;
  breakdown: {
    service: number;
    fee: number;
    iva: number;
    total: number;
  };
  currency: string;
  error: string | null;
};

const stripePromises = new Map<string, ReturnType<typeof loadStripe>>();
function getStripePromise(key: string | null | undefined) {
  if (!key) return null;
  if (!stripePromises.has(key)) {
    stripePromises.set(key, loadStripe(key));
  }
  return stripePromises.get(key) ?? null;
}

function useOnsitePaymentIntent(
  onsiteRequestId: string | null,
  amount: number,
  currency: string,
  open: boolean,
) {
  const [state, setState] = React.useState<IntentState>(() => ({
    loading: false,
    clientSecret: null,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
    paymentMode: null,
    breakdown: {
      service: amount,
      fee: 0,
      iva: 0,
      total: amount,
    },
    currency,
    error: null,
  }));

  React.useEffect(() => {
    if (!open || !onsiteRequestId) return;
    let cancelled = false;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      paymentMode: null,
      breakdown: {
        service: amount,
        fee: 0,
        iva: 0,
        total: amount,
      },
      currency,
    }));
    (async () => {
      type IntentResponse = {
        clientSecret?: string | null;
        publishableKey?: string | null;
        paymentMode?: "test" | "live" | null;
        currency?: string | null;
        breakdown?: {
          service?: number;
          fee?: number;
          iva?: number;
          total?: number;
        };
        error?: string | null;
      };
      try {
        const res = await fetch(
          `/api/onsite-quote-requests/${encodeURIComponent(onsiteRequestId)}/payment-intent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            credentials: "include",
          },
        );
        const json = (await res
          .json()
          .catch(() => null)) as IntentResponse | null;
        if (cancelled) return;
        if (!res.ok || !json?.clientSecret) {
          const normalized = normalizeAppError(
            {
              message: json?.error || "PAYMENT_INTENT_FAILED",
              detail: json?.error || null,
            },
            { status: res.status, source: "onsite.payment-intent" },
          );
          setState((prev) => ({
            ...prev,
            loading: false,
            error: normalized.userMessage,
          }));
          reportError({
            error: json?.error || "PAYMENT_INTENT_FAILED",
            normalized,
            area: "payments",
            feature: "create-onsite-payment-intent",
            route: "chat.onsite-payment",
            blocking: true,
            extra: { onsiteRequestId },
          });
          return;
        }
        setState((prev) => ({
          ...prev,
          loading: false,
          clientSecret: json.clientSecret || null,
          publishableKey:
            json.publishableKey ??
            prev.publishableKey ??
            process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
            null,
          paymentMode: json.paymentMode ?? null,
          currency: json.currency || currency,
          breakdown: {
            service: Number(json.breakdown?.service ?? amount) || amount,
            fee: Number(json.breakdown?.fee ?? 0) || 0,
            iva: Number(json.breakdown?.iva ?? 0) || 0,
            total: Number(json.breakdown?.total ?? amount) || amount,
          },
          error: null,
        }));
      } catch (error) {
        if (cancelled) return;
        const normalized = normalizeAppError(error, {
          source: "onsite.payment-intent",
        });
        setState((prev) => ({
          ...prev,
          loading: false,
          error: normalized.userMessage,
        }));
        reportError({
          error,
          normalized,
          area: "payments",
          feature: "create-onsite-payment-intent",
          route: "chat.onsite-payment",
          blocking: true,
          extra: { onsiteRequestId },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount, currency, onsiteRequestId, open]);

  return state;
}

function OnsitePaymentContent({
  amount,
  currency,
  breakdown,
  paymentMode,
  selectedMethod,
  onSelectMethod,
  termsAccepted,
  onToggleTerms,
  onPaymentSuccess,
  onClose,
  isLoading,
  isRemunerable,
}: {
  amount: number;
  currency: string;
  breakdown: IntentState["breakdown"];
  paymentMode: IntentState["paymentMode"];
  selectedMethod: PaymentMethod;
  onSelectMethod: (m: PaymentMethod) => void;
  termsAccepted: boolean;
  onToggleTerms: (next: boolean) => void;
  onPaymentSuccess: (piId?: string | null) => Promise<void> | void;
  onClose: () => void;
  isLoading: boolean;
  isRemunerable: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fmt = React.useMemo(
    () =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currency || "MXN",
      }),
    [currency],
  );

  const confirmPayment = React.useCallback(async () => {
    if (selectedMethod === "paypal") {
      setError("PayPal estará disponible muy pronto.");
      return;
    }
    if (!stripe || !elements) {
      setError("Stripe no está listo aún. Intenta de nuevo en unos segundos.");
      return;
    }
    setSubmitting(true);
    setError(null);
    trackEvent("fee_checkout_started", {
      flow: "onsite_quote_payment",
      source_page:
        typeof window !== "undefined" ? window.location.pathname : undefined,
      payment_method: selectedMethod,
      payment_mode: paymentMode,
      amount_total: breakdown.total,
      currency,
    });
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (result.error) {
      const normalized = normalizeAppError(result.error, {
        source: "onsite.confirm-payment",
      });
      setError(normalized.userMessage);
      reportError({
        error: result.error,
        normalized,
        area: "payments",
        feature: "confirm-onsite-payment",
        route: "chat.onsite-payment",
        blocking: true,
      });
      setSubmitting(false);
      return;
    }
    const status = result.paymentIntent?.status;
    if (
      status === "succeeded" ||
      status === "processing" ||
      status === "requires_capture"
    ) {
      trackEvent("fee_paid", {
        flow: "onsite_quote_payment",
        source_page:
          typeof window !== "undefined" ? window.location.pathname : undefined,
        payment_method: selectedMethod,
        payment_mode: paymentMode,
        payment_intent_id: result.paymentIntent?.id ?? null,
        payment_status: status,
        amount_total: breakdown.total,
        currency,
      });
      toast.success("Pago confirmado");
      await onPaymentSuccess(result.paymentIntent?.id ?? null);
      onClose();
    } else {
      setError("No pudimos confirmar el pago. Intenta nuevamente.");
    }
    setSubmitting(false);
  }, [
    breakdown.total,
    currency,
    elements,
    onClose,
    onPaymentSuccess,
    paymentMode,
    selectedMethod,
    stripe,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Pago seguro
            </p>
            <p className="text-xl font-semibold text-slate-900">
              Cotización en sitio
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Stripe
            </Badge>
            {paymentMode === "test" ? (
              <Badge variant="secondary" className="text-xs">
                Pago de prueba
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 rounded-2xl border bg-white/70 p-4 shadow-sm sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Costo de la cotización en sitio</span>
              <span className="font-semibold text-slate-900">
                {fmt.format(amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Comisión</span>
              <span className="font-semibold text-slate-900">
                {fmt.format(breakdown.fee)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>IVA (16%)</span>
              <span className="font-semibold text-slate-900">
                {fmt.format(breakdown.iva)}
              </span>
            </div>
            <div className="h-px bg-muted" />
            <div className="flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Total a pagar hoy</span>
              <span className="text-lg">{fmt.format(breakdown.total)}</span>
            </div>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-blue-700">Cómo funciona</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-900">
              <li>Protegemos tu pago de forma segura.</li>
              <li>Este pago cubre la visita de valoración en sitio.</li>
              {isRemunerable ? (
                <li>
                  Este monto se descontará al contratar el servicio final en
                  Handi.
                </li>
              ) : (
                <li>
                  Esta cotización en sitio no es remunerable en la contratación
                  final.
                </li>
              )}
              <li>
                Si no contratas el servicio, este pago no se reembolsa porque
                cubre la visita en sitio.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">Método de pago</p>
          <span className="text-xs text-muted-foreground">
            Selecciona tu preferencia
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={clsx(
              "rounded-xl border px-3 py-2 text-left text-sm transition",
              selectedMethod === "card"
                ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sm"
                : "border-muted bg-white hover:border-blue-300",
            )}
            onClick={() => onSelectMethod("card")}
          >
            <div className="font-semibold">Tarjeta</div>
            <div className="text-xs text-muted-foreground">
              Débito o crédito
            </div>
          </button>
          <button
            type="button"
            className={clsx(
              "rounded-xl border px-3 py-2 text-left text-sm transition",
              selectedMethod === "paypal"
                ? "border-slate-400 bg-slate-50 text-slate-800"
                : "border-muted bg-white hover:border-slate-300",
            )}
            onClick={() => onSelectMethod("paypal")}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">PayPal</span>
              <Badge variant="secondary" className="text-[11px]">
                Próximamente
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Mantendremos tu lugar
            </div>
          </button>
        </div>
        {selectedMethod === "card" ? (
          <div className="rounded-xl border bg-white/80 p-4 shadow-inner">
            <PaymentElement options={{ layout: "tabs" }} />
            <p className="mt-2 text-xs text-muted-foreground">
              Tus datos se cifran y no se almacenan en Handi.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
            PayPal estará disponible pronto. Elige tarjeta para completar tu
            pago ahora.
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 rounded-lg border bg-white/70 p-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-slate-300"
          checked={termsAccepted}
          onChange={(event) => onToggleTerms(event.target.checked)}
        />
        <span>
          Entiendo que este pago corresponde a la cotización en sitio y acepto
          los términos aplicables.
        </span>
      </label>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={submitting || isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => void confirmPayment()}
          disabled={submitting || isLoading || !termsAccepted}
        >
          {submitting ? "Procesando..." : "Confirmar pago"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function OnsitePaymentDialog({
  open,
  onOpenChange,
  onsiteRequestId,
  amount,
  currency = "MXN",
  isRemunerable = false,
  onSuccess,
}: OnsitePaymentDialogProps) {
  const safeAmount =
    typeof amount === "number" && Number.isFinite(amount) && amount > 0
      ? amount
      : 0;
  const [selectedMethod, setSelectedMethod] =
    React.useState<PaymentMethod>("card");
  const [termsAccepted, setTermsAccepted] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setSelectedMethod("card");
      setTermsAccepted(false);
    }
  }, [open]);

  const intent = useOnsitePaymentIntent(
    onsiteRequestId,
    safeAmount,
    currency,
    open,
  );

  const stripePromise = React.useMemo(
    () => getStripePromise(intent.publishableKey),
    [intent.publishableKey],
  );
  const elementsOptions = React.useMemo<StripeElementsOptions | null>(() => {
    if (!intent.clientSecret) return null;
    return {
      clientSecret: intent.clientSecret,
      appearance: { theme: "stripe" },
      loader: "auto",
    };
  }, [intent.clientSecret]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleSuccess = React.useCallback(async () => {
    onSuccess?.();
  }, [onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pago de cotización en sitio</DialogTitle>
          <DialogDescription>
            Completa el pago sin salir de Handi.
          </DialogDescription>
        </DialogHeader>

        {intent.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {intent.error}
          </div>
        ) : null}
        {!intent.error &&
        stripePromise &&
        elementsOptions &&
        intent.clientSecret ? (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <OnsitePaymentContent
              amount={safeAmount}
              currency={intent.currency || currency}
              breakdown={intent.breakdown}
              paymentMode={intent.paymentMode}
              selectedMethod={selectedMethod}
              onSelectMethod={setSelectedMethod}
              termsAccepted={termsAccepted}
              onToggleTerms={setTermsAccepted}
              onPaymentSuccess={handleSuccess}
              onClose={close}
              isLoading={intent.loading}
              isRemunerable={isRemunerable}
            />
          </Elements>
        ) : !intent.error ? (
          <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-20 animate-pulse rounded bg-slate-200" />
            <div className="h-10 animate-pulse rounded bg-slate-200" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
