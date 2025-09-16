"use client";
import * as React from "react";
import { toast } from "sonner";

export default function ActiveUserTypeSwitcher() {
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

  if (loading || !canSwitch || !other) return null;

  const label = `Cambiar tipo de usuario a ${other}`;

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
      // Force refresh to re-render header/menus
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cambiar el tipo";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={submitting}
      onClick={onSwitch}
      className="w-full text-left block rounded px-2 py-1.5 text-sm hover:bg-neutral-100"
    >
      {label}
    </button>
  );
}
