"use client";
import * as React from "react";
import { SquarePen, Save, X, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function RequestHeaderActions({ requestId }: { requestId: string }) {
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    function onChange(e: Event) {
      const ce = e as CustomEvent<{ id?: string; edit?: boolean }>;
      if (ce?.detail?.id && String(ce.detail.id) === String(requestId)) {
        setEditing(Boolean(ce.detail.edit));
      }
    }
    window.addEventListener("request-edit-change", onChange as EventListener);
    return () => window.removeEventListener("request-edit-change", onChange as EventListener);
  }, [requestId]);

  function emit(name: string, detail?: Record<string, unknown>) {
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent(name, { detail: { id: requestId, ...(detail || {}) } }));
  }

  if (!editing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          emit("request-edit");
          setEditing(true);
        }}
        aria-label="Editar"
        className="gap-1"
      >
        <SquarePen className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={() => emit("request-save")}
        aria-label="Guardar"
        className="gap-1"
      >
        <Save className="h-4 w-4" />
        <span>Guardar</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          emit("request-cancel");
          setEditing(false);
        }}
        aria-label="Cancelar"
        className="gap-1"
      >
        <X className="h-4 w-4" />
        <span>Cancelar</span>
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => emit("request-delete")}
        aria-label="Eliminar"
        className="gap-1"
      >
        <Trash2 className="h-4 w-4" />
        <span>Eliminar</span>
      </Button>
    </div>
  );
}
