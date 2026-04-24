"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  ReceiptText,
  Upload,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ManualPayoutCandidate = {
  candidateId: string;
  payoutId: string | null;
  requestId: string;
  agreementId: string | null;
  professionalId: string;
  requestTitle: string;
  professionalName: string;
  amount: number;
  currency: string;
  requestStatus: string | null;
  requestStatusLabel: string;
  canCreate: boolean;
  blockReason: string | null;
  source: "existing_pending" | "inferred";
};

type CandidatesResponse = {
  ok?: boolean;
  items?: ManualPayoutCandidate[];
  commissionPercent?: number;
  error?: string;
};

function formatMoney(amount: number, currency: string) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency || "MXN",
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `$${safeAmount.toFixed(2)} ${currency || "MXN"}`;
  }
}

function StepMarker({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
          done
            ? "border-emerald-600 bg-emerald-600 text-white"
            : active
              ? "border-[#082877] bg-[#082877] text-white"
              : "border-slate-300 bg-white text-slate-500"
        }`}
      >
        {done ? (
          <CheckCircle2 size={16} />
        ) : (
          <Circle size={14} fill="currentColor" />
        )}
      </span>
      <span
        className={active ? "font-semibold text-slate-900" : "text-slate-600"}
      >
        {label}
      </span>
    </div>
  );
}

export default function ManualPayoutDialog({
  onCreated,
}: {
  onCreated: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [items, setItems] = React.useState<ManualPayoutCandidate[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const [commissionPercent, setCommissionPercent] = React.useState<number>(5);

  const selected = React.useMemo(
    () => items.find((item) => item.candidateId === selectedId) ?? null,
    [items, selectedId],
  );

  const reset = React.useCallback(() => {
    setStep(1);
    setItems([]);
    setSelectedId(null);
    setReceiptFile(null);
    setCommissionPercent(5);
  }, []);

  async function fetchCandidates() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/payouts/manual-candidates", {
        cache: "no-store",
      });
      const json = (await response
        .json()
        .catch(() => ({}))) as CandidatesResponse;
      if (!response.ok || !json.ok) {
        throw new Error(
          json.error || "No se pudieron cargar los payouts manuales.",
        );
      }
      setItems(Array.isArray(json.items) ? json.items : []);
      setCommissionPercent(
        typeof json.commissionPercent === "number" ? json.commissionPercent : 5,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los payouts manuales.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    void fetchCandidates();
  }, [open, reset]);

  async function handleConfirm() {
    if (!selected) {
      toast.error("Selecciona un payout.");
      return;
    }
    if (!receiptFile) {
      toast.error("Sube el comprobante del payout.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("candidateId", selected.candidateId);
      form.set("receipt", receiptFile);
      const response = await fetch("/api/admin/payouts/manual", {
        method: "POST",
        body: form,
      });
      const json = await response
        .json()
        .catch(() => ({}) as { error?: string });
      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error || "No se pudo confirmar el payout manual.",
        );
      }
      toast.success("Payout manual confirmado.");
      setOpen(false);
      await onCreated();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo confirmar el payout manual.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Crear
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Crear payout manual</DialogTitle>
            <DialogDescription>
              Selecciona un servicio elegible, sube el comprobante y confirma el
              payout sin duplicar la infraestructura automática.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <StepMarker
              active={step === 1}
              done={step === 2}
              label="Seleccionar payout"
            />
            <ChevronRight className="text-slate-400" size={16} />
            <StepMarker
              active={step === 2}
              done={false}
              label="Subir comprobante"
            />
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Profesional</TableHead>
                      <TableHead>Monto neto</TableHead>
                      <TableHead>Estatus</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-sm text-slate-500"
                        >
                          Cargando payouts manuales...
                        </TableCell>
                      </TableRow>
                    ) : items.length ? (
                      items.map((item) => {
                        const selectedRow = item.candidateId === selectedId;
                        return (
                          <TableRow
                            key={item.candidateId}
                            className={selectedRow ? "bg-slate-50" : undefined}
                          >
                            <TableCell>
                              <div className="font-medium text-slate-900">
                                {item.requestTitle}
                              </div>
                              <div className="text-xs text-slate-500">
                                {item.source === "existing_pending"
                                  ? "Payout pendiente ya generado"
                                  : "Detectado desde pagos ya cobrados"}
                              </div>
                            </TableCell>
                            <TableCell>{item.professionalName}</TableCell>
                            <TableCell className="tabular-nums">
                              {formatMoney(item.amount, item.currency)}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {item.requestStatusLabel}
                              </div>
                              {!item.canCreate && item.blockReason ? (
                                <div className="text-xs text-amber-700">
                                  {item.blockReason}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant={selectedRow ? "default" : "outline"}
                                disabled={!item.canCreate}
                                onClick={() => setSelectedId(item.candidateId)}
                              >
                                {selectedRow ? "Seleccionado" : "Seleccionar"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-sm text-slate-500"
                        >
                          No hay payouts manuales disponibles.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Comisión al profesional configurada:{" "}
                <strong>{commissionPercent}%</strong>. El monto mostrado ya
                incluye ese descuento.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Servicio
                  </div>
                  <div className="mt-1 font-medium text-slate-900">
                    {selected?.requestTitle}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Profesional
                  </div>
                  <div className="mt-1 font-medium text-slate-900">
                    {selected?.professionalName}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Monto a pagar
                  </div>
                  <div className="mt-1 font-medium text-slate-900">
                    {selected
                      ? formatMoney(selected.amount, selected.currency)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estatus del servicio
                  </div>
                  <div className="mt-1 font-medium text-slate-900">
                    {selected?.requestStatusLabel}
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Upload size={16} />
                  Subir recibo del payout
                </div>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setReceiptFile(file);
                  }}
                />
                <p className="text-xs text-slate-500">
                  Adjunta la imagen o PDF del comprobante. Se enviará al
                  profesional junto con la confirmación del payout.
                </p>
                {receiptFile ? (
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <ReceiptText size={16} />
                    {receiptFile.name}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="text-xs text-slate-500">
              {selected && step === 1
                ? `${selected.requestTitle} | ${selected.professionalName}`
                : "Selecciona un payout listo para liberar."}
            </div>
            <div className="flex gap-2">
              {step === 2 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                >
                  Regresar
                </Button>
              ) : null}
              {step === 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!selected || !selected.canCreate}
                >
                  Crear payout
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting || !receiptFile}
                >
                  {submitting ? "Confirmando..." : "Confirmar"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
