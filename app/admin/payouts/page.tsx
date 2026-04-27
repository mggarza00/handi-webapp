"use client";
import { useEffect, useMemo, useState } from "react";

import ManualPayoutDialog from "@/components/admin/payouts/ManualPayoutDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Payout = {
  id: string;
  professional_id: string;
  professional_name: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "canceled";
  created_at: string;
  paid_at: string | null;
  receipt_url: string | null;
  payout_kind: "service_offer" | "onsite_quote";
  type_label: string;
  remuneration_label: "Remunerable" | "No remunerable" | null;
  request_id: string | null;
  request_title: string | null;
  relation_label: string | null;
  gross_amount: number | null;
  commission_amount: number | null;
};

function formatMoney(amount: number, currency: string) {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency || "MXN",
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `$${safe.toFixed(2)} ${currency || "MXN"}`;
  }
}

export default function AdminPayoutsPage() {
  const [items, setItems] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "pending").length,
    [items],
  );

  useEffect(() => {
    void fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/payouts", { cache: "no-store" });
      const json = await response.json();
      setItems(Array.isArray(json.items) ? (json.items as Payout[]) : []);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay(id: string) {
    setPayingId(id);
    try {
      const response = await fetch(`/api/admin/payouts/${id}/pay`, {
        method: "POST",
      });
      await response.json().catch(() => null);
      await fetchData();
    } finally {
      setPayingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Payouts</h1>
          <p className="text-sm text-muted-foreground">
            Pendientes: {pendingCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ManualPayoutDialog onCreated={fetchData} />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            Recargar
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Profesional</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Solicitud</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((payout) => (
              <TableRow key={payout.id}>
                <TableCell className="font-mono text-xs">{payout.id}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      {payout.type_label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {payout.remuneration_label ? (
                        <Badge
                          variant="outline"
                          className={
                            payout.remuneration_label === "Remunerable"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }
                        >
                          {payout.remuneration_label}
                        </Badge>
                      ) : null}
                    </div>
                    {payout.relation_label ? (
                      <div className="text-xs text-muted-foreground">
                        {payout.relation_label}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{payout.professional_name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {payout.professional_id}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  <div className="font-medium">
                    {formatMoney(payout.amount, payout.currency)}
                  </div>
                  {payout.gross_amount != null ||
                  payout.commission_amount != null ? (
                    <div className="text-xs text-muted-foreground">
                      {payout.gross_amount != null
                        ? `Bruto ${formatMoney(payout.gross_amount, payout.currency)}`
                        : null}
                      {payout.gross_amount != null &&
                      payout.commission_amount != null
                        ? " · "
                        : null}
                      {payout.commission_amount != null
                        ? `Comisión ${formatMoney(payout.commission_amount, payout.currency)}`
                        : null}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm">{payout.request_title || "—"}</div>
                    {payout.request_id ? (
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {payout.request_id}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{payout.status}</TableCell>
                <TableCell>
                  {new Date(payout.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {payout.status === "pending" ? (
                    <Button
                      size="sm"
                      onClick={() => handlePay(payout.id)}
                      disabled={payingId === payout.id}
                    >
                      {payingId === payout.id ? "Pagando..." : "Pagar"}
                    </Button>
                  ) : payout.receipt_url ? (
                    <a
                      href={payout.receipt_url}
                      className="text-sm text-primary underline underline-offset-4"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver comprobante
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Pagado
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && !loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-muted-foreground"
                >
                  Sin payouts.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
