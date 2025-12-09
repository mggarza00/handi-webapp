"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

type Props = {
  id: string;
  status: string | null;
};

export function ProChangeActionsCell({ id, status }: Props) {
  const [adminName, setAdminName] = React.useState<string>("Admin");
  const [loading, setLoading] = React.useState(false);
  const [approvedBy, setApprovedBy] = React.useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = React.useState<string>("");
  const isPending = status === "pending" && !approvedBy;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store", credentials: "include" });
        const j = await r.json().catch(() => null);
        const name = (j?.user?.name as string | undefined) || (j?.user?.email as string | undefined);
        if (!cancelled && name) setAdminName(name);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function approve() {
    setLoading(true);
    try {
      const res = await fetch(`/api/profile-change-requests/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "No se pudo aprobar");
      }
      setApprovedBy(adminName);
      toast.success("Cambios aprobados");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    if (!rejectNotes.trim()) {
      // Opcional: permitir sin motivo; si se desea requerir comentario, descomentar siguiente línea
      // return toast.error("Agrega un motivo para rechazar");
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/profile-change-requests/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ review_notes: rejectNotes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "No se pudo rechazar");
      }
      toast.message("Solicitud rechazada");
      // No actualizamos visualmente estado/reviewer; mantenemos simple como pidió el requerimiento (solo caso aprobar)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (approvedBy) {
    return (
      <div className="text-right text-xs text-emerald-700">Aprobado por: {approvedBy}</div>
    );
  }

  if (!isPending) {
    return <div className="text-right text-xs text-slate-500">—</div>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link href={`/admin/pro-changes/${id}`} className="rounded border px-3 py-1.5 text-xs hover:bg-slate-50">Ver cambios</Link>
      <button
        className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
        type="button"
        disabled={loading}
        onClick={approve}
      >
        Aprobar
      </button>
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Motivo (opcional)"
          value={rejectNotes}
          onChange={(e) => setRejectNotes(e.currentTarget.value)}
          className="h-8 w-40 rounded border px-2 text-xs"
        />
        <button
          className="rounded bg-red-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          type="button"
          disabled={loading}
          onClick={reject}
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
