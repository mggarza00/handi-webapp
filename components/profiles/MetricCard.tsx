import * as React from "react";

import { Card } from "@/components/ui/card";

export type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  ariaLabel?: string;
};

export default function MetricCard({ label, value, ariaLabel }: MetricCardProps) {
  return (
    <Card className="p-4" aria-label={ariaLabel ?? label}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </Card>
  );
}
