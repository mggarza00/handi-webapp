"use client";
import * as React from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";

export type ClientFeeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount?: number | null; // Monto del servicio (MXN)
  currency?: string; // Default MXN
  onConfirm: () => void; // Continuar a pago
  confirmLabel?: string; // Texto del botón de confirmación
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeClientFee(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const base = amount * 0.05; // 5%
  const fee = Math.min(1500, Math.max(50, base));
  return round2(fee);
}

export function ClientFeeDialog({ open, onOpenChange, amount = null, currency = "MXN", onConfirm, confirmLabel = "Continuar al pago" }: ClientFeeDialogProps) {
  const safeAmount = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const fee = React.useMemo(() => computeClientFee(safeAmount), [safeAmount]);
  const ivaRate = 0.16;
  const iva = React.useMemo(() => round2(((safeAmount || 0) + (fee || 0)) * ivaRate), [safeAmount, fee]);
  const totalToday = React.useMemo(() => round2((safeAmount || 0) + (fee || 0) + (iva || 0)), [safeAmount, fee, iva]);
  const fmt = React.useMemo(() => new Intl.NumberFormat("es-MX", { style: "currency", currency }), [currency]);
  void ivaRate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded-2xl p-0 overflow-hidden">
        <div className="p-6 sm:p-7">
          {/* Resumen */}
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Monto del servicio</p>
                  <p className="text-lg font-semibold">{fmt.format(safeAmount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Comisión</p>
                  <p className="text-lg font-semibold">{fmt.format(fee)}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">IVA (16%)</p>
                <p className="text-sm font-medium">{fmt.format(iva)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <p className="text-sm">Total a pagar hoy</p>
                <p className="text-xl font-bold">{fmt.format(totalToday)}</p>
              </div>
            </div>

            <div className="rounded-2xl border p-4 sm:p-5 bg-blue-50 border-blue-100">
              <div className="flex items-center justify-center gap-2 text-[1.2rem] font-semibold text-primary">
                <Image src="/images/icono-pago-seguro.png" alt="Pago seguro" width={24} height={24} />
                <span>Pago Seguro</span>
              </div>
              <p className="mt-2 text-base text-slate-700 text-center">
                El pago se libera al profesional una vez que confirmes que el trabajo se realizó con éxito.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 px-6 sm:px-7 py-4 flex items-center justify-between gap-3">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="success" type="button" onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientFeeDialog;
