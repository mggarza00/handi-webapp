import React from "react";

export default function PendingAlert({ at }: { at: string | null }) {
  if (!at) return null;
  const ts = new Date(at);
  const text = Number.isFinite(ts.getTime()) ? ts.toLocaleString() : at;
  return (
    <div className="rounded-2xl border bg-yellow-50 text-yellow-900 p-4">
      Tienes una solicitud pendiente desde {text}.
    </div>
  );
}

