"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type MeOrder = {
  id: string;
  status: string | null;
  amount: number | null;
  created_at: string | null;
  request?: {
    id: string;
    title: string | null;
    city: string | null;
    category: string | null;
    required_at: string | null;
  } | null;
  professional?: {
    id: string;
    full_name: string | null;
  } | null;
};

type MyOrdersTabsProps = {
  active: MeOrder[];
  completed: MeOrder[];
};

export default function MyOrdersTabs({ active, completed }: MyOrdersTabsProps) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const items = useMemo(
    () => (tab === "active" ? active : completed),
    [active, completed, tab],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <div className="inline-flex w-full max-w-sm items-center rounded-full bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`flex-1 rounded-full px-3 py-1.5 text-center text-sm font-medium transition ${
              tab === "active"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600"
            }`}
          >
            Activas ({active.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("completed")}
            className={`flex-1 rounded-full px-3 py-1.5 text-center text-sm font-medium transition ${
              tab === "completed"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600"
            }`}
          >
            Completadas ({completed.length})
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {tab === "active"
            ? "No tienes órdenes activas."
            : "Aún no tienes órdenes completadas."}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((order) => (
            <li
              key={order.id}
              className="rounded-2xl border bg-white px-3 py-3"
            >
              <OrderRow order={order} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: MeOrder }) {
  const statusMeta = normalizeStatus(order.status);
  const price = formatCurrency(order.amount);
  const date = formatDate(order.request?.required_at ?? order.created_at);
  const href = order.request?.id ? `/requests/${order.request.id}` : "#";

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border bg-slate-50 text-lg">
        🔧
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-medium leading-tight text-slate-900 truncate">
            {order.request?.title ?? "Trabajo sin título"}
          </h3>
          {order.request?.category ? (
            <Badge variant="outline" className="bg-slate-50 text-slate-700">
              {order.request.category}
            </Badge>
          ) : null}
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        </div>
        <div className="text-sm text-slate-600">
          {order.professional?.full_name ?? "Profesional asignado"}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 text-sm text-slate-600">
        <div className="font-semibold text-slate-900">{price}</div>
        <div>{date}</div>
        <Button variant="outline" size="sm" asChild>
          <a
            href={href}
            aria-disabled={!order.request?.id}
            className={
              !order.request?.id ? "pointer-events-none opacity-60" : undefined
            }
          >
            Ver detalles
          </a>
        </Button>
      </div>
    </div>
  );
}

function normalizeStatus(status: string | null | undefined): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (status) {
    case "completed":
      return { label: "Completado", variant: "secondary" };
    case "in_progress":
      return { label: "En progreso", variant: "default" };
    case "accepted":
      return { label: "Programado", variant: "outline" };
    case "paid":
      return { label: "Pagado", variant: "secondary" };
    case "negotiating":
      return { label: "En negociación", variant: "outline" };
    case "disputed":
      return { label: "En disputa", variant: "destructive" };
    case "cancelled":
      return { label: "Cancelado", variant: "destructive" };
    default:
      return { label: "Sin estado", variant: "outline" };
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "— MXN";
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} MXN`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Fecha por definir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha por definir";
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
