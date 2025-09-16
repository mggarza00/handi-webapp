"use client";
import * as React from "react";

export default function EditButton({ requestId }: { requestId: string }) {
  function onClick() {
    if (typeof window !== "undefined") {
      const ev = new CustomEvent("request-edit", { detail: { id: requestId } });
      window.dispatchEvent(ev);
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      aria-label="Editar solicitud"
    >
      Editar
    </button>
  );
}

