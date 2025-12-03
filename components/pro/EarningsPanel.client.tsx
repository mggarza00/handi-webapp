"use client";
import * as React from "react";

import EarningsChart, { type Point } from "@/components/pro/EarningsChart";

type Tab = "week" | "fortnight" | "month";

export default function EarningsPanel({ week, fortnight, month }: { week: Point[]; fortnight: Point[]; month: Point[] }) {
  const [tab, setTab] = React.useState<Tab>("week");
  const series = tab === "week" ? week : tab === "fortnight" ? fortnight : month;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <button
          className={`rounded-full border px-3 py-1 ${tab === "week" ? "bg-neutral-900 text-white" : "bg-white"}`}
          onClick={() => setTab("week")}
        >
          Semana
        </button>
        <button
          className={`rounded-full border px-3 py-1 ${tab === "fortnight" ? "bg-neutral-900 text-white" : "bg-white"}`}
          onClick={() => setTab("fortnight")}
        >
          Quincena
        </button>
        <button
          className={`rounded-full border px-3 py-1 ${tab === "month" ? "bg-neutral-900 text-white" : "bg-white"}`}
          onClick={() => setTab("month")}
        >
          Mes
        </button>
      </div>
      <EarningsChart series={series} />
    </div>
  );
}
