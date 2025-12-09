"use client";
import * as React from "react";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";

export default function UserTypeInfo({
  currentRole,
  onAction,
}: {
  currentRole: "client" | "pro" | "admin" | null;
  onAction?: () => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [canSwitch, setCanSwitch] = React.useState(false);
  const [other, setOther] = React.useState<"cliente" | "profesional" | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [activeRole, setActiveRole] = React.useState(currentRole);

  const router = useRouter();
  const pathname = usePathname();

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

  React.useEffect(() => {
    setActiveRole(currentRole);
  }, [currentRole]);

  const currentLabel =
    activeRole === "pro"
      ? "profesional"
      : activeRole === "client"
        ? "cliente"
        : activeRole === "admin"
          ? "admin"
          : "—";

  async function onSwitch() {
    try {
      onAction?.();
    } catch {
      /* ignore */
    }
    if (!other) {
      toast.error("No hay un tipo alternativo disponible");
      return;
    }
    const switchedTo = other;
    try {
      setSubmitting(true);
      const res = await fetch("/api/profile/switch-active-user-type", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ to: switchedTo }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.detail || j?.error || "switch_failed");
      const nextRole =
        switchedTo === "profesional"
          ? "pro"
          : switchedTo === "cliente"
            ? "client"
            : ((j?.data?.role ?? null) as "client" | "pro" | "admin" | null);
      if (nextRole) {
        setActiveRole(nextRole);
        setOther(
          nextRole === "pro"
            ? "cliente"
            : nextRole === "client"
              ? "profesional"
              : null,
        );
      }
      toast.success(
        switchedTo
          ? `Tipo activo cambiado a ${switchedTo}`
          : "Tipo activo actualizado",
      );
      // Asegura que la página de destino reciba el rol actualizado desde el servidor.
      // Si ya estamos en "/", solo refrescamos. Si no, navegamos primero y luego refrescamos.
      if (pathname === "/") {
        router.refresh();
      } else {
        const url = `/?r=${Date.now()}`; // rompe posibles cachés del router
        router.push(url);
        setTimeout(() => {
          try {
            router.refresh();
          } catch {
            void 0; // ignore
          }
        }, 120);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cambiar el tipo";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-2 py-1.5 text-sm text-white">
      <div>
        Tipo de usuario:{" "}
        <span className="font-medium text-white">{currentLabel}</span>
      </div>
      {!loading && canSwitch && other ? (
        <button
          type="button"
          disabled={submitting}
          onClick={onSwitch}
          className="mt-1 w-full rounded px-2 py-1.5 text-sm text-white hover:bg-white/10 flex items-center gap-2 disabled:opacity-60"
        >
          <span aria-hidden className="text-white/70">
            ⇄
          </span>
          {`cambiar a ${other}`}
        </button>
      ) : null}
    </div>
  );
}
