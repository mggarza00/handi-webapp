"use client";
import { useEffect, useMemo, useState } from "react";

import ManualPayoutDialog from "@/components/admin/payouts/ManualPayoutDialog";
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
      const r = await fetch("/api/admin/payouts", { cache: "no-store" });
      const j = await r.json();
      setItems(Array.isArray(j.items) ? (j.items as Payout[]) : []);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay(id: string) {
    setPayingId(id);
    try {
      const r = await fetch(`/api/admin/payouts/${id}/pay`, { method: "POST" });
      await r.json().catch(() => null);
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
              <TableHead>Profesional</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell>{p.professional_name}</TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(p.amount, p.currency)}
                </TableCell>
                <TableCell>{p.status}</TableCell>
                <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {p.status === "pending" ? (
                    <Button
                      size="sm"
                      onClick={() => handlePay(p.id)}
                      disabled={payingId === p.id}
                    >
                      {payingId === p.id ? "Pagando..." : "Pagar"}
                    </Button>
                  ) : p.receipt_url ? (
                    <a
                      href={p.receipt_url}
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
                  colSpan={6}
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
