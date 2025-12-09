"use client";
import * as React from "react";

export default function KpiCard({ title, value, subtle }: { title: string; value: string | number; subtle?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${subtle ? "bg-white/50" : "bg-white"}`}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

