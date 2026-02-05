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

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { computeClientTotals } from "@/lib/payments/fees";

type PaymentMethod = "card" | "paypal";

type PaymentIntentState = {
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

type OfferPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string | null;
  amount: number | null;
  currency?: string;
  title?: string | null;
  onSuccess?: () => void;
};

const stripePromises = new Map<string, ReturnType<typeof loadStripe>>();

function mapTotals(amount: number) {
  const totals = computeClientTotals(amount);
  return {
    service: totals.amount,
    fee: totals.fee,
    iva: totals.iva,
    total: totals.total,
  };
}

function getStripePromise(key: string | null | undefined) {
  if (!key) return null;
  if (!stripePromises.has(key)) {
    stripePromises.set(key, loadStripe(key));
  }
  return stripePromises.get(key) ?? null;
}

function usePaymentIntent(
  offerId: string | null,
  amount: number,
  currency: string,
  open: boolean,
) {
  const [state, setState] = React.useState<PaymentIntentState>(() => ({
    loading: false,
    clientSecret: null,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
    paymentMode: null,
    breakdown: mapTotals(amount),
    currency,
    error: null,
  }));

  React.useEffect(() => {
    if (!open || !offerId) return;
    let cancelled = false;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      paymentMode: null,
      breakdown: mapTotals(amount),
      currency,
    }));
    (async () => {
      type PaymentIntentResponse = {
        clientSecret?: string | null;
        publishableKey?: string | null;
        paymentMode?: "test" | "live" | null;
        breakdown?: {
          service?: number;
          fee?: number;
          iva?: number;
          total?: number;
        };
        currency?: string | null;
        error?: string | null;
      };
      try {
        const res = await fetch(
          `/api/offers/${encodeURIComponent(offerId)}/payment-intent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            credentials: "include",
          },
        );
        const json = (await res
          .json()
          .catch(() => null)) as PaymentIntentResponse | null;
        if (cancelled) return;
        if (!res.ok || !json?.clientSecret) {
          const message = json?.error || "No se pudo iniciar el pago";
          setState((prev) => ({ ...prev, loading: false, error: message }));
          return;
        }
        const breakdown =
          json?.breakdown && typeof json.breakdown === "object"
            ? {
                service: Number(json.breakdown.service ?? amount) || 0,
                fee: Number(json.breakdown.fee ?? 0) || 0,
                iva: Number(json.breakdown.iva ?? 0) || 0,
                total: Number(json.breakdown.total ?? amount) || amount,
              }
            : mapTotals(amount);
        setState((prev) => ({
          ...prev,
          loading: false,
          clientSecret: json?.clientSecret || null,
          publishableKey:
            json?.publishableKey ??
            prev.publishableKey ??
            process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
            null,
          paymentMode: json?.paymentMode ?? null,
          breakdown,
          currency: json?.currency || currency,
          error: null,
        }));
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Error de red";
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offerId, amount, currency, open]);

  return state;
}

function PaymentContent({
  breakdown,
  currency,
  title,
  amount,
  paymentMode,
  selectedMethod,
  onSelectMethod,
  termsAccepted,
  onToggleTerms,
  onPaymentSuccess,
  onClose,
  isLoading,
}: {
  breakdown: PaymentIntentState["breakdown"];
  currency: string;
  title?: string | null;
  amount: number;
  paymentMode: PaymentIntentState["paymentMode"];
  selectedMethod: PaymentMethod;
  onSelectMethod: (m: PaymentMethod) => void;
  termsAccepted: boolean;
  onToggleTerms: (next: boolean) => void;
  onPaymentSuccess: (piId?: string | null) => Promise<void> | void;
  onClose: () => void;
  isLoading: boolean;
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
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message || "No se pudo procesar el pago");
      setSubmitting(false);
      return;
    }
    const status = result.paymentIntent?.status;
    if (
      status === "succeeded" ||
      status === "processing" ||
      status === "requires_capture"
    ) {
      toast.success("Pago confirmado");
      await onPaymentSuccess(result.paymentIntent?.id ?? null);
      onClose();
    } else {
      setError("No pudimos confirmar el pago. Intenta nuevamente.");
    }
    setSubmitting(false);
  }, [elements, onClose, onPaymentSuccess, selectedMethod, stripe]);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Pago seguro
            </p>
            <p className="text-xl font-semibold text-slate-900">
              {title || "Confirma tu pago"}
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
              <span>Monto del servicio</span>
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
              <li>Guardamos tu pago de forma segura.</li>
              <li>
                El profesional solo lo recibe cuando confirmes el servicio.
              </li>
              <li>Si algo sale mal, te ayudamos a resolverlo.</li>
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

      <div className="flex items-start gap-3 rounded-xl border bg-white/70 p-3">
        <input
          id="agree-terms"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          checked={termsAccepted}
          onChange={(e) => onToggleTerms(e.target.checked)}
        />
        <label
          htmlFor="agree-terms"
          className="text-sm text-slate-800 leading-5"
        >
          Acepto los{" "}
          <a
            href="/terms-and-conditions"
            className="text-blue-800 underline font-semibold"
          >
            términos y condiciones
          </a>{" "}
          y autorizo el cargo por {fmt.format(breakdown.total)}.
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <DialogFooter className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Total a pagar:{" "}
          <span className="font-semibold text-slate-900">
            {fmt.format(breakdown.total)}
          </span>
        </div>
        <div className="flex gap-2">
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
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => {
              void confirmPayment();
            }}
            disabled={
              submitting ||
              isLoading ||
              !termsAccepted ||
              selectedMethod === "paypal"
            }
          >
            {submitting
              ? "Procesando..."
              : selectedMethod === "paypal"
                ? "No disponible"
                : "Confirmar pago"}
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}

export function OfferPaymentDialog({
  open,
  onOpenChange,
  offerId,
  amount,
  currency = "MXN",
  title,
  onSuccess,
}: OfferPaymentDialogProps) {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const intent = usePaymentIntent(offerId, safeAmount, currency, open);
  const [method, setMethod] = React.useState<PaymentMethod>("card");
  const [termsAccepted, setTermsAccepted] = React.useState(false);

  const notifyPaidMessage = React.useCallback(
    async (piId?: string | null) => {
      if (!offerId) return;
      try {
        if (piId) {
          // Intentamos sincronizar el pago en el backend (idempotente, reproduce automatizaciones del webhook)
          await fetch(
            `/api/offers/${encodeURIComponent(offerId)}/sync-payment-intent`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json; charset=utf-8" },
              body: JSON.stringify({ paymentIntentId: piId }),
            },
          );
        }
        await fetch(`/api/offers/${encodeURIComponent(offerId)}/paid-message`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      } catch {
        // ignore (webhook should cover this; this is just a best-effort client nudge)
      }
      onSuccess?.();
    },
    [offerId, onSuccess],
  );

  React.useEffect(() => {
    if (!open) {
      setTermsAccepted(false);
      setMethod("card");
    }
  }, [open]);

  const stripePromise = getStripePromise(
    intent.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
  const options: StripeElementsOptions | undefined =
    intent.clientSecret && stripePromise
      ? {
          clientSecret: intent.clientSecret,
          appearance: {
            theme: "flat",
            labels: "floating",
            variables: {
              colorPrimary: "#2563eb",
              colorText: "#0f172a",
            },
          },
          loader: "auto",
          locale: "es",
        }
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[780px] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto rounded-3xl p-0 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Pago</DialogTitle>
          <DialogDescription>
            Completa el pago seguro de tu oferta.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 sm:p-8">
          {intent.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {intent.error}
            </div>
          ) : null}
          {intent.clientSecret && stripePromise && options ? (
            <Elements stripe={stripePromise} options={options}>
              <PaymentContent
                breakdown={intent.breakdown}
                currency={intent.currency}
                title={title}
                amount={safeAmount}
                paymentMode={intent.paymentMode}
                selectedMethod={method}
                onSelectMethod={setMethod}
                termsAccepted={termsAccepted}
                onToggleTerms={setTermsAccepted}
                onPaymentSuccess={notifyPaidMessage}
                onClose={() => onOpenChange(false)}
                isLoading={intent.loading}
              />
            </Elements>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border bg-white/60 p-4">
                <div className="text-sm text-slate-700">
                  {intent.loading
                    ? "Preparando el pago..."
                    : method === "paypal"
                      ? "PayPal estará disponible pronto. Selecciona tarjeta para completar tu pago."
                      : "Selecciona tarjeta para continuar"}
                </div>
              </div>
              <DialogFooter className="flex justify-end">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OfferPaymentDialog;
