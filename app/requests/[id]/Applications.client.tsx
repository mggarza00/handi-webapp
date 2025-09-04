"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { requestId: string; createdBy: string | null };

type AppItem = {
  id: string;
  note: string | null;
  status: string | null;
  created_at: string | null;
  professional_id: string;
  pro_full_name?: string | null;
  pro_rating?: number | null;
  pro_headline?: string | null;
};

export default function ApplicationsClient({ requestId, createdBy }: Props) {
  const [items, setItems] = React.useState<AppItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [me, setMe] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmTarget, setConfirmTarget] = React.useState<{ id: string; next: "accepted" | "rejected" } | null>(null);
  const [requestBudget, setRequestBudget] = React.useState<number | null>(null);
  const [amountEdits, setAmountEdits] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Presupuesto de la solicitud para default de montos
        try {
          const r = await fetch(`/api/requests/${requestId}`, { headers: { "Content-Type": "application/json; charset=utf-8" }, cache: "no-store", signal: controller.signal });
          const j = await r.json();
          if (r.ok) {
            const b = Number(j?.data?.budget ?? NaN);
            if (Number.isFinite(b)) setRequestBudget(b);
          }
        } catch {
          /* ignore */
        }
        // Fetch current user id to determine ownership
        try {
          const meRes = await fetch(`/api/me`, { headers: { "Content-Type": "application/json; charset=utf-8" } });
          const meJson = await meRes.json();
          if (meRes.ok && meJson?.user?.id) setMe(meJson.user.id as string);
        } catch {
          /* ignore unauthenticated */
        }
        const res = await fetch(`/api/requests/${requestId}/applications`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "No se pudieron cargar las postulaciones");
        const list: AppItem[] = json.data ?? [];
        setItems(list);
        // Prefill inputs por application id
        setAmountEdits((prev) => {
          const next = { ...prev };
          for (const a of list) {
            if (next[a.id] === undefined && requestBudget != null) next[a.id] = String(requestBudget);
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
  }, [requestId, requestBudget]);

  if (loading) return <p className="text-sm">Cargando postulaciones…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!items?.length) return <p className="text-sm text-gray-600">Aún no hay postulaciones.</p>;

  return (
    <>
    <ul className="divide-y rounded border">
      {items.map((a) => (
        <li key={a.id} className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">{a.status ?? "applied"}</p>
              <p className="text-xs text-gray-500">
                Pro: {" "}
                <Link href={`/profiles/${a.professional_id}`} className="hover:underline">
                  {a.pro_full_name ?? a.professional_id.slice(0, 8) + "…"}
                </Link>{" "}
                · Rating: {a.pro_rating ?? "—"} · {a.created_at?.slice(0, 10)}
              </p>
              {a.note && <p className="text-sm mt-1 whitespace-pre-line">{a.note}</p>}
            </div>
            {createdBy && me && createdBy === me && (a.status === null || a.status === "applied") && (
              <div className="flex items-center gap-2">
                <button
                  className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                  onClick={() => {
                    setConfirmTarget({ id: a.id, next: "accepted" });
                    setConfirmOpen(true);
                  }}
                >
                  Aceptar
                </button>
                <button
                  className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                  onClick={() => {
                    setConfirmTarget({ id: a.id, next: "rejected" });
                    setConfirmOpen(true);
                  }}
                >
                  Rechazar
                </button>
              </div>
            )}
            {createdBy && me && createdBy === me && a.status === "accepted" && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Monto (MXN)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-28 rounded border px-2 py-1 text-xs"
                  value={amountEdits[a.id] ?? (requestBudget != null ? String(requestBudget) : "")}
                  onChange={(e) => setAmountEdits((m) => ({ ...m, [a.id]: e.target.value }))}
                />
                <button
                  className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                  onClick={async () => {
                    const raw = amountEdits[a.id] ?? (requestBudget != null ? String(requestBudget) : "");
                    const amount = Number(raw);
                    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Monto inválido");
                    // Crear acuerdo
                    const res = await fetch(`/api/agreements`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json; charset=utf-8" },
                      body: JSON.stringify({ request_id: requestId, professional_id: a.professional_id, amount }),
                    });
                    const agr = await res.json();
                    if (!res.ok) return toast.error(agr?.error || "No se pudo crear el acuerdo");
                    // Marcar acuerdo como aceptado
                    const res2 = await fetch(`/api/agreements/${agr?.data?.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json; charset=utf-8" },
                      body: JSON.stringify({ status: "accepted" }),
                    });
                    const j2 = await res2.json();
                    if (!res2.ok) return toast.error(j2?.error || "No se pudo aceptar el acuerdo");
                    toast.success("Acuerdo creado y aceptado");
                  }}
                >
                  Crear acuerdo (aceptado)
                </button>
              </div>
            )}
            {createdBy && me && createdBy === me && a.status === "accepted" && (
              <div className="flex items-center gap-2">
                <button
                  className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                  onClick={async () => {
                    const res = await fetch(`/api/applications/${a.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json; charset=utf-8" },
                      body: JSON.stringify({ status: "completed" }),
                    });
                    const j = await res.json();
                    if (!res.ok) return toast.error(j?.error || "No se pudo completar");
                    setItems((prev) => prev?.map((it) => (it.id === a.id ? { ...it, status: "completed" } : it)) ?? prev);
                    toast.success("Postulación marcada como completada");
                  }}
                >
                  Marcar como completada
                </button>
                <button
                  className="text-xs rounded px-2 py-1 border hover:bg-gray-50"
                  onClick={async () => {
                    const raw = amountEdits[a.id] ?? (requestBudget != null ? String(requestBudget) : "");
                    const amount = Number(raw);
                    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Monto inválido");
                    // Crear acuerdo
                    const res = await fetch(`/api/agreements`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json; charset=utf-8" },
                      body: JSON.stringify({ request_id: requestId, professional_id: a.professional_id, amount }),
                    });
                    const agr = await res.json();
                    if (!res.ok) return toast.error(agr?.error || "No se pudo crear el acuerdo");
                    // Iniciar checkout (fee)
                    const res2 = await fetch(`/api/stripe/checkout`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json; charset=utf-8" },
                      body: JSON.stringify({ request_id: requestId, amount_mxn: amount, agreement_id: agr?.data?.id }),
                    });
                    const chk = await res2.json();
                    if (!res2.ok || !chk?.url) return toast.error(chk?.error || "No se pudo iniciar el checkout");
                    window.location.assign(chk.url as string);
                  }}
                >
                  Crear acuerdo + Checkout
                </button>
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
            {confirmTarget?.next === "accepted" ? "Aceptar postulación" : "Rechazar postulación"}
          </DialogTitle>
          <DialogDescription>
            {confirmTarget?.next === "accepted"
              ? "Confirmas aceptar esta postulación?"
              : "Confirmas rechazar esta postulación?"}
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
              const res = await fetch(`/api/applications/${confirmTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify({ status: confirmTarget.next }),
              });
              const j = await res.json();
              if (!res.ok) return toast.error(j?.error || "Operación fallida");
              setItems((prev) => prev?.map((it) => (it.id === confirmTarget.id ? { ...it, status: confirmTarget.next } : it)) ?? prev);
              toast.success(confirmTarget.next === "accepted" ? "Postulación aceptada" : "Postulación rechazada");
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
