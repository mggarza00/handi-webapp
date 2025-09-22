"use client";
import Link from "next/link";

type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const lastIdx = items.length - 1;
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-slate-600">
      <ol className="flex items-center gap-1 flex-wrap">
        {items.map((it, idx) => {
          const isLast = idx === lastIdx;
          return (
            <li
              key={`${it.label}-${idx}`}
              className="inline-flex items-center gap-1"
            >
              {it.href && !isLast ? (
                <Link href={it.href} className="hover:underline">
                  {it.label}
                </Link>
              ) : (
                <span className="text-slate-900">{it.label}</span>
              )}
              {!isLast && <span className="mx-1">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
