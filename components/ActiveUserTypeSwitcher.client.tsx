"use client";
import * as React from "react";
import { toast } from "sonner";

import { normalizeAppError } from "@/lib/errors/app-error";
import { reportError } from "@/lib/errors/report-error";

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
      if (!res.ok) {
        throw {
          message: j?.error || "SWITCH_FAILED",
          detail: j?.detail || null,
          status: res.status,
        };
      }
      toast.success(`Tipo activo cambiado a ${other}`);
      const targetPath = other === "profesional" ? "/pro" : "/";
      window.location.href = targetPath;
    } catch (e) {
      const normalized = normalizeAppError(e, {
        source: "profile.switch-active-role",
      });
      const userMessage =
        "No pudimos cambiar tu tipo de usuario. Intenta de nuevo.";
      toast.error(userMessage);
      reportError({
        error: e,
        normalized: { ...normalized, code: "ROLE_SWITCH_FAILED" },
        area: "profile",
        feature: "active-user-type-switcher",
        route: "header",
        blocking: true,
        extra: { requestedRole: other },
      });
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
