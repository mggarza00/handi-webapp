"use client";
import * as React from "react";

import EarningsChart, { type Point } from "@/components/pro/EarningsChart";

type Tab = "week" | "fortnight" | "month";

export default function EarningsPanel({
  week,
  fortnight,
  month,
}: {
  week: Point[];
  fortnight: Point[];
  month: Point[];
}) {
  const [tab, setTab] = React.useState<Tab>("week");
  const series =
    tab === "week" ? week : tab === "fortnight" ? fortnight : month;
  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 rounded-full bg-[#082877]/5 p-1 text-sm font-medium">
        <button
          className={`rounded-full px-4 py-1.5 transition-colors ${
            tab === "week"
              ? "bg-[#082877] text-white shadow-sm"
              : "text-[#082877]"
          }`}
          onClick={() => setTab("week")}
        >
          Semana
        </button>
        <button
          className={`rounded-full px-4 py-1.5 transition-colors ${
            tab === "fortnight"
              ? "bg-[#082877] text-white shadow-sm"
              : "text-[#082877]"
          }`}
          onClick={() => setTab("fortnight")}
        >
          Quincena
        </button>
        <button
          className={`rounded-full px-4 py-1.5 transition-colors ${
            tab === "month"
              ? "bg-[#082877] text-white shadow-sm"
              : "text-[#082877]"
          }`}
          onClick={() => setTab("month")}
        >
          Mes
        </button>
      </div>
      <EarningsChart series={series} />
    </div>
  );
}
