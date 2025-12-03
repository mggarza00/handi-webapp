"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";

const logStorageError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("[AdminCollapseToggle]", error);
  }
};

type Props = {
  targetId?: string;
  className?: string;
};

/**
 * Toggle para colapsar/expandir el sidebar de Admin en desktop.
 * Usa data-attribute en el contenedor `#admin-shell` para aplicar estilos
 * y persiste el estado en localStorage bajo la clave `admin.sidebar.collapsed`.
 */
export default function AdminCollapseToggle({ targetId = "admin-shell", className }: Props) {
  const [collapsed, setCollapsed] = React.useState(false);

  // Leer estado inicial desde localStorage y aplicarlo al contenedor
  React.useEffect(() => {
    try {
      const v = localStorage.getItem("admin.sidebar.collapsed");
      const initial = v === "1";
      setCollapsed(initial);
      const el = document.getElementById(targetId);
      if (el) el.setAttribute("data-collapsed", initial ? "true" : "false");
    } catch (error) {
      logStorageError(error);
    }
  }, [targetId]);

  const toggle = React.useCallback(() => {
    const el = document.getElementById(targetId);
    const next = !collapsed;
    setCollapsed(next);
    if (el) el.setAttribute("data-collapsed", next ? "true" : "false");
    try {
      localStorage.setItem("admin.sidebar.collapsed", next ? "1" : "0");
    } catch (error) {
      logStorageError(error);
    }
  }, [collapsed, targetId]);

  return (
    <button
      type="button"
      aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      onClick={toggle}
      className={cn(
        "hidden md:inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground shadow-xs hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
        className,
      )}
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}
