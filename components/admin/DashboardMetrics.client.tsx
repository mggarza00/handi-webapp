"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Lines = dynamic(() => import("@/components/admin/DashboardLines"), { ssr: false });

type Trend = { date: string; requests: number };
type Kpis = {
  requestsToday: number;
  conversionRate: number;
  paymentsToday: number;
  payoutsPending: number;
  activeProfessionals: number;
  slaAvgHours: number;
  openTickets?: number;
};

export default function DashboardMetrics() {
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [trend, setTrend] = useState<Trend[]>([]);
  const [series, setSeries] = useState<Array<{ date: string; requests: number; payments: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("range", String(range));
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const r = await fetch(`/api/admin/metrics?${params.toString()}`, { cache: "no-store" });
    const j = await r.json();
    setKpis(j.kpis as Kpis);
    setTrend(j.trend as Trend[]);
    if (Array.isArray(j.series)) setSeries(j.series as Array<{ date: string; requests: number; payments: number }>);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard title="Solicitudes (hoy)" value={kpis?.requestsToday ?? "—"} loading={loading} />
        <KpiCard title="Conversión (30d)" value={kpis ? `${kpis.conversionRate}%` : "—"} loading={loading} />
        <KpiCard title="Pagos hoy (MXN)" value={kpis ? kpis.paymentsToday.toLocaleString() : "—"} loading={loading} />
        <KpiCard title="Payouts pendientes" value={kpis?.payoutsPending ?? "—"} loading={loading} />
        <KpiCard title="Profesionales activos" value={kpis?.activeProfessionals ?? "—"} loading={loading} />
        <KpiCard title="SLA promedio (h)" value={kpis?.slaAvgHours ?? "—"} loading={loading} />
        {typeof kpis?.openTickets === 'number' ? (
          <KpiCard title="Tickets abiertos" value={kpis!.openTickets!} loading={loading} />
        ) : null}
      </div>

      <section className="rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm opacity-70">Tendencia ({range} días)</div>
          <div className="flex items-center gap-2">
            <RangeButton active={range === 7} onClick={() => setRange(7)}>7d</RangeButton>
            <RangeButton active={range === 14} onClick={() => setRange(14)}>14d</RangeButton>
            <RangeButton active={range === 30} onClick={() => setRange(30)}>30d</RangeButton>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" />
            <Button variant="outline" size="sm" onClick={fetchData}>Aplicar</Button>
            <a
              href={`/api/admin/metrics/export${(() => { const p = new URLSearchParams(); p.set("range", String(range)); if (from) p.set("from", from); if (to) p.set("to", to); const s = p.toString(); return s ? `?${s}` : ""; })()}`}
              className="rounded-md border px-3 py-1 text-xs"
            >
              Exportar CSV
            </a>
          </div>
        </div>
        <Lines data={series.length ? series : trend.map((t) => ({ ...t, payments: 0 }))} />
      </section>
    </div>
  );
}

function KpiCard({ title, value, loading }: { title: string; value: string | number; loading?: boolean }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm opacity-70">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{loading ? "—" : value}</div>
    </div>
  );
}

function RangeButton({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs ${active ? "bg-accent" : ""}`}
    >
      {children}
    </button>
  );
}
