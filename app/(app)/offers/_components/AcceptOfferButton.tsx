"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";

const BankAccountGateModal = dynamic(() => import("./BankAccountGateModal"), { ssr: false });

export type AcceptOfferButtonProps = {
  offerId: string;
  conversationId?: string;
  onAccepted?: (opts?: { checkoutUrl?: string | null }) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
};

export default function AcceptOfferButton({ offerId, conversationId, onAccepted, children, className, disabled, "data-testid": dataTestId }: AcceptOfferButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function acceptNow() {
    if (!offerId || busy) return;
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      let json: { ok?: boolean; error?: string; checkoutUrl?: string | null } = {};
      // Preferir aceptar por conversacion cuando la tenemos (más robusto frente a ids inconsistentes)
      if (conversationId) {
        res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/offers/accept`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
        json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; checkoutUrl?: string | null };
        if (res.status === 404) {
          // Fallback: intenta por id de oferta
          res = await fetch(`/api/offers/${encodeURIComponent(offerId)}/accept`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
          json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; checkoutUrl?: string | null };
        }
      } else {
        res = await fetch(`/api/offers/${encodeURIComponent(offerId)}/accept`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
        json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; checkoutUrl?: string | null };
        if (res.status === 404 && conversationId) {
          res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/offers/accept`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
          json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; checkoutUrl?: string | null };
        }
      }
      // Fallback: si el backend rechaza por falta de cuenta bancaria, abre el gate
      if (res.status === 409 && String(json?.error || "").toLowerCase() === "bank_account_required") {
        setOpen(true);
        return;
      }
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "No se pudo aceptar la oferta");
      onAccepted?.({ checkoutUrl: json?.checkoutUrl ?? null });
      // No redirigir al profesional a la pasarela; el pago lo inicia el cliente
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown_error");
    } finally {
      setBusy(false);
    }
  }

  async function handleClick() {
    setError(null);
    // Verifica cuenta confirmada primero
    try {
      const res = await fetch("/api/me/bank-account", { cache: "no-store", credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; hasConfirmed?: boolean; account?: { status?: string } | null };
      const confirmed = Boolean(json?.hasConfirmed) || String(json?.account?.status || "").toLowerCase() === "confirmed";
      if (res.ok && json?.ok !== false && confirmed) {
        await acceptNow();
      } else {
        setOpen(true);
      }
    } catch {
      // En caso de error de red, abre el modal para permitir captura y reintento
      setOpen(true);
    }
  }

  return (
    <>
      <Button className={className} onClick={() => void handleClick()} disabled={busy || !!disabled} data-testid={dataTestId || "accept-offer"}>
        {busy ? "Procesando…" : children ?? "Aceptar oferta"}
      </Button>
      {open ? (
        <BankAccountGateModal
          open={open}
          onOpenChange={setOpen}
          onAcceptOffer={() => acceptNow()}
        />
      ) : null}
      {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
    </>
  );
}
