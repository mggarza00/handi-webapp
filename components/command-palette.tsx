'use client'
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

type Item = { label: string; href: Route };

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items: Item[] = [
    { label: "Ir al Dashboard", href: "/dashboard" as Route },
    { label: "Ver Solicitudes", href: "/requests" as Route },
    { label: "Ver Profesionales", href: "/professionals" as Route },
    { label: "Nueva Solicitud", href: "/requests?new=1" as Route },
  ];

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase())
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4">
      <div className="mt-24 w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-soft">
        <input
          autoFocus
          placeholder="Escribe un comando..."
          className="w-full rounded-t-2xl bg-transparent px-4 py-3 outline-none border-b border-neutral-200 dark:border-neutral-800"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered[0]) {
              router.push(filtered[0].href);
              onClose();
            }
          }}
        />
        <ul className="max-h-64 overflow-auto">
          {filtered.map((i) => (
            <li key={i.href}>
              <button
                className="w-full text-left px-4 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                onClick={() => {
                  router.push(i.href);
                  onClose();
                }}
              >
                {i.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-500">Sin resultados</li>
          )}
        </ul>
      </div>
    </div>
  );
}
