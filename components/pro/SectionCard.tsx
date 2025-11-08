import * as React from "react";

export default function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

