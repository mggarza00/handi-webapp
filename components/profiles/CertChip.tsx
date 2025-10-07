import * as React from "react";

export default function CertChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex max-w-[220px] items-center rounded-full border border-emerald-600/40 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 overflow-hidden whitespace-nowrap text-ellipsis"
      title={typeof children === 'string' ? children : undefined}
    >
      {children}
    </span>
  );
}
