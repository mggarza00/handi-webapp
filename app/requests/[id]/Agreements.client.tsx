"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = { requestId: string; createdBy?: string | null };

type AgreementItem = {
  id: string;
  professional_id: string;
  amount: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export default function AgreementsClient({ requestId, createdBy }: Props) {
  const [items, setItems] = React.useState<AgreementItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [me, setMe] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmTarget, setConfirmTarget] = React.useState<{
    id: string;
    next: "in_progress" | "completed" | "cancelled";
  } | null>(null);
  const [requestBudget, setRequestBudget] = React.useState<number | null>(null);
  const [amountEdits, setAmountEdits] = React.useState<Record<string, string>>(
    {},
  );

  const money = React.useMemo(
    () =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
      }),
    [],
  );

  function statusBadge(status?: string | null) {
    const s = status ?? "negotiating";
    switch (s) {
      case "accepted":
        return <Badge variant="default">Aceptado</Badge>;
      case "paid":
        return (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
            Pagado
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-600 text-white hover:bg-blue-600">
            En progreso
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-gray-800 text-white hover:bg-gray-800">
            Completado
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">Cancelado</Badge>;
      case "disputed":
        return <Badge variant="destructive">En disputa</Badge>;
      case "negotiating":
      default:
        return <Badge variant="outline">En negociación</Badge>;
    }
  }

  function Timeline({
    status,
    created_at,
    updated_at,
  }: {
    status: string | null | undefined;
    created_at: string | null | undefined;
    updated_at: string | null | undefined;
  }) {
    const steps = [
      "negotiating",
      "accepted",
      "paid",
      "in_progress",
      "completed",
    ] as const;
    const current = (status ?? "negotiating") as (typeof steps)[number];
    const idx = Math.max(0, steps.indexOf(current));
    return (
      <ol className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
        {steps.map((st, i) => (
          <li key={st} className="flex items-center gap-1">
            <span
              className={`inline-block size-2 rounded-full ${i <= idx ? "bg-black" : "bg-gray-300"}`}
            />
            <span className={i <= idx ? "font-medium" : ""}>
              {st.replace("_", " ")}
              {i === 0 && created_at ? ` · ${created_at.slice(0, 10)}` : ""}
              {i === idx && updated_at ? ` · ${updated_at.slice(0, 10)}` : ""}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 text-gray-400">›</span>
            )}
          </li>
        ))}
      </ol>
    );
  }

  React.useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Presupuesto de la solicitud (para default de monto)
        try {
          const r = await fetch(`/api/requests/${requestId}`, {
            headers: { "Content-Type": "application/json; charset=utf-8" },
            cache: "no-store",
            signal: controller.signal,
          });
          const j = await r.json();
          if (r.ok) {
            const b = Number(j?.data?.budget ?? NaN);
            if (Number.isFinite(b)) setRequestBudget(b);
          }
        } catch {
          /* ignore */
        }
        try {
          const meRes = await fetch(`/api/me`, {
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
          const meJson = await meRes.json();
          if (meRes.ok && meJson?.user?.id) setMe(meJson.user.id as string);
        } catch {
          /* unauthenticated OK */
        }
        const res = await fetch(`/api/requests/${requestId}/agreements`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
        const json = await res.json();
        if (!res.ok)
          throw new Error(json?.error || "No se pudieron cargar los acuerdos");
        const list: AgreementItem[] = json.data ?? [];
        setItems(list);
        // Prefill inputs
        setAmountEdits((prev) => {
          const next = { ...prev };
          for (const a of list) {
            const def = a.amount ?? requestBudget ?? null;
            if (def != null && next[a.id] === undefined)
              next[a.id] = String(def);
          }
          return next;
        });
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "UNKNOWN");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [requestId, nonce, requestBudget]);

  // Escucha eventos para refrescar lista desde otros componentes (e.g., Prospectos)
  React.useEffect(() => {
    function onRefresh(e: Event) {
      const ce = e as CustomEvent<string>;
      const targetId = ce?.detail;
      if (!targetId || targetId === requestId) setNonce((n) => n + 1);
    }
    window.addEventListener("agreements:refresh", onRefresh as EventListener);
    return () =>
      window.removeEventListener(
        "agreements:refresh",
        onRefresh as EventListener,
      );
  }, [requestId]);

  if (loading) return <p className="text-sm">Cargando acuerdos…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!items?.length)
    return <p className="text-sm text-gray-600">Aún no hay acuerdos.</p>;

  return (
    <>
      <ul className="divide-y rounded border">
        {items.map((a) => (
          <li key={a.id} className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {statusBadge(a.status)}
                  <span className="text-sm font-medium">
                    {money.format(a.amount ?? 0)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pro:{" "}
                  <Link
                    href={`/profiles/${a.professional_id}`}
                    className="hover:underline"
                  >
                    {a.professional_id.slice(0, 8)}…
                  </Link>{" "}
                  · {a.created_at?.slice(0, 10)}
                </p>
                <Timeline
                  status={a.status}
                  created_at={a.created_at}
                  updated_at={a.updated_at}
                />
              </div>
              {createdBy &&
                me &&
                (me === createdBy || me === a.professional_id) && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600">
                        Monto (MXN)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-28 rounded border px-2 py-1 text-xs"
                        value={
                          amountEdits[a.id] ??
                          (a.amount != null
                            ? String(a.amount)
                            : requestBudget != null
                              ? String(requestBudget)
                              : "")
                        }
                        onChange={(e) =>
                          setAmountEdits((m) => ({
                            ...m,
                            [a.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                        onClick={async () => {
                          const raw =
                            amountEdits[a.id] ??
                            (a.amount != null
                              ? String(a.amount)
                              : requestBudget != null
                                ? String(requestBudget)
                                : "");
                          const val = Number(raw);
                          if (!Number.isFinite(val) || val <= 0)
                            return toast.error("Monto inválido");
                          const r = await fetch(`/api/agreements/${a.id}`, {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json; charset=utf-8",
                            },
                            body: JSON.stringify({ amount: val }),
                          });
                          const j = await r.json();
                          if (!r.ok)
                            return toast.error(
                              j?.error || "No se pudo actualizar el monto",
                            );
                          setItems(
                            (prev) =>
                              prev?.map((it) =>
                                it.id === a.id ? { ...it, amount: val } : it,
                              ) ?? prev,
                          );
                          toast.success("Monto actualizado");
                        }}
                      >
                        Guardar monto
                      </button>
                    </div>
                    {createdBy &&
                      me &&
                      me === createdBy &&
                      a.status === "accepted" && (
                        <button
                          className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                          onClick={async () => {
                            const r = await fetch(`/api/stripe/checkout`, {
                              method: "POST",
                              headers: {
                                "Content-Type":
                                  "application/json; charset=utf-8",
                              },
                              body: JSON.stringify({
                                request_id: requestId,
                                agreement_id: a.id,
                              }),
                            });
                            const j = await r.json();
                            if (!r.ok || !j?.url)
                              return toast.error(
                                j?.error || "No se pudo iniciar el checkout",
                              );
                            window.location.assign(j.url as string);
                          }}
                        >
                          Pagar fee
                        </button>
                      )}
                    {a.status === "paid" && (
                      <button
                        className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                        onClick={() => {
                          setConfirmTarget({ id: a.id, next: "in_progress" });
                          setConfirmOpen(true);
                        }}
                      >
                        Iniciar trabajo
                      </button>
                    )}
                    {a.status === "in_progress" && (
                      <button
                        className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                        onClick={() => {
                          setConfirmTarget({ id: a.id, next: "completed" });
                          setConfirmOpen(true);
                        }}
                      >
                        Marcar completado
                      </button>
                    )}
                    {(a.status === "negotiating" ||
                      a.status === "accepted") && (
                      <button
                        className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                        onClick={() => {
                          setConfirmTarget({ id: a.id, next: "cancelled" });
                          setConfirmOpen(true);
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                )}
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmTarget?.next === "completed"
                ? "Marcar acuerdo como completado"
                : confirmTarget?.next === "in_progress"
                  ? "Iniciar trabajo"
                  : "Cancelar acuerdo"}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget?.next === "completed"
                ? "Confirma que el trabajo fue realizado satisfactoriamente."
                : confirmTarget?.next === "in_progress"
                  ? "Confirma que iniciarás el trabajo asociado a este acuerdo."
                  : "Esta acción cancelará el acuerdo. Puedes crear uno nuevo después si lo necesitas."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              className="text-xs rounded px-3 py-1.5 border hover:bg-gray-50"
              onClick={() => setConfirmOpen(false)}
            >
              Volver
            </button>
            <button
              className="text-xs rounded px-3 py-1.5 border bg-black text-white hover:bg-black/90"
              onClick={async () => {
                if (!confirmTarget) return;
                const r = await fetch(`/api/agreements/${confirmTarget.id}`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json; charset=utf-8",
                  },
                  body: JSON.stringify({ status: confirmTarget.next }),
                });
                const j = await r.json();
                if (!r.ok) {
                  toast.error(j?.error || "Operación fallida");
                } else {
                  setItems(
                    (prev) =>
                      prev?.map((it) =>
                        it.id === confirmTarget.id
                          ? { ...it, status: confirmTarget.next }
                          : it,
                      ) ?? prev,
                  );
                  toast.success(
                    confirmTarget.next === "completed"
                      ? "Acuerdo completado"
                      : confirmTarget.next === "in_progress"
                        ? "Trabajo iniciado"
                        : "Acuerdo cancelado",
                  );
                }
                setConfirmOpen(false);
                setConfirmTarget(null);
              }}
            >
              Confirmar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
