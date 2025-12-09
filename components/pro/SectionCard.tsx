import * as React from "react";

export default function SectionCard({
  title,
  action,
  icon,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          {icon ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#082877]/10 text-[#082877]">
              {icon}
            </div>
          ) : null}
          <h3 className="text-sm font-semibold text-[#082877]">{title}</h3>
        </div>
        {action ? (
          <div className="text-xs font-semibold text-[#082877]">{action}</div>
        ) : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
