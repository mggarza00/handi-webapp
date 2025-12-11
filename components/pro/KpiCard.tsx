"use client";
import * as React from "react";

export default function KpiCard({
  title,
  value,
  icon,
  subtle,
}: {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-slate-100 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)] ${
        subtle ? "bg-white" : "bg-[rgba(8,40,119,0.05)]"
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#082877]/15 text-[#082877]">
        {icon}
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-[#6B7280]">{title}</div>
        <div className="text-3xl font-bold leading-tight text-[#082877] tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      </div>
    </div>
  );
}
