"use client";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "refunded" | "failed" | "canceled" | "disputed";
  customer: string;
  created_at: string;
  payment_kind: "offer_payment" | "onsite_quote";
  type_label: string;
  remuneration_label: "Remunerable" | "No remunerable" | null;
  request_id: string | null;
  request_title: string | null;
  relation_label: string | null;
  onsite_credit_amount: number | null;
};

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency || "MXN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} ${currency || "MXN"}`;
  }
}

export default function AdminPaymentsPage() {
  const [items, setItems] = useState<Payment[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const response = await fetch(
      `/api/admin/payments${params.toString() ? `?${params}` : ""}`,
      { cache: "no-store" },
    );
    const json = await response.json();
    setItems(Array.isArray(json.items) ? (json.items as Payment[]) : []);
  }

  const exportHref = `/api/admin/payments/export${(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return query ? `?${query}` : "";
  })()}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 w-40"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 w-40"
        />
        <Button variant="outline" size="sm" onClick={fetchData}>
          Filtrar
        </Button>
        <a
          href={exportHref}
          className="h-9 rounded-md border px-3 text-sm inline-flex items-center"
        >
          Exportar CSV
        </a>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Solicitud</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((payment) => (
              <TableRow
                key={`${payment.request_id || payment.id}:${payment.id}`}
              >
                <TableCell className="font-mono text-xs">
                  {payment.id}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      {payment.type_label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {payment.remuneration_label ? (
                        <Badge
                          variant="outline"
                          className={
                            payment.remuneration_label === "Remunerable"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }
                        >
                          {payment.remuneration_label}
                        </Badge>
                      ) : null}
                    </div>
                    {payment.relation_label ? (
                      <div className="text-xs text-muted-foreground">
                        {payment.relation_label}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  <div className="font-medium">
                    {formatMoney(payment.amount, payment.currency)}
                  </div>
                  {payment.payment_kind === "offer_payment" &&
                  payment.onsite_credit_amount ? (
                    <div className="text-xs text-muted-foreground">
                      Descuento onsite:{" "}
                      {formatMoney(
                        payment.onsite_credit_amount,
                        payment.currency,
                      )}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{payment.status}</TableCell>
                <TableCell>{payment.customer}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm">
                      {payment.request_title || "—"}
                    </div>
                    {payment.request_id ? (
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {payment.request_id}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(payment.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
