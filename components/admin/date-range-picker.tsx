"use client";
import { Input } from "@/components/ui/input";

export default function DateRangePicker({ from, to, onChange }: { from: string; to: string; onChange: (next: { from: string; to: string }) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="date" value={from} onChange={(e) => onChange({ from: e.target.value, to })} className="h-9 w-40" />
      <Input type="date" value={to} onChange={(e) => onChange({ from, to: e.target.value })} className="h-9 w-40" />
    </div>
  );
}

