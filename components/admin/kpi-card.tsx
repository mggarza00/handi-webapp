import React from "react";

export default function KpiCard({ title, value, hint }: { title: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm opacity-70" title={hint}>{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

