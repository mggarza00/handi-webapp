"use client";
import * as React from "react";
import { toast } from "sonner";

export default function UserTypeInfo({
  currentRole,
}: {
  currentRole: "client" | "pro" | "admin" | null;
}) {
  const [loading, setLoading] = React.useState(true);
  const [canSwitch, setCanSwitch] = React.useState(false);
  const [other, setOther] = React.useState<"cliente" | "profesional" | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/can-switch", {
          cache: "no-store",
        });
        const j = await res.json();
        if (!cancelled) {
          setCanSwitch(Boolean(j?.canSwitch));
          setOther((j?.other as typeof other) ?? null);
        }
      } catch {
        if (!cancelled) setCanSwitch(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentLabel =
    currentRole === "pro"
      ? "profesional"
      : currentRole === "client"
      ? "cliente"
      : currentRole === "admin"
      ? "admin"
      : "—";

  async function onSwitch() {
    try {
      setSubmitting(true);
      const res = await fetch("/api/profile/switch-active-user-type", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ to: other }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.detail || j?.error || "switch_failed");
      toast.success(`Tipo activo cambiado a ${other}`);
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cambiar el tipo";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-2 py-1.5 text-sm">
      <div>
        Tipo de usuario: <span className="font-medium">{currentLabel}</span>
      </div>
      {!loading && canSwitch && other ? (
        <button
          type="button"
          disabled={submitting}
          onClick={onSwitch}
          className="mt-1 w-full rounded px-2 py-1.5 text-sm hover:bg-neutral-100 flex items-center gap-2"
        >
          <span aria-hidden className="text-neutral-600">⇄</span>
          {`cambiar a ${other}`}
        </button>
      ) : null}
    </div>
  );
}
