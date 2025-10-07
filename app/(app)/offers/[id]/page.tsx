"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OfferRedirectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const search = useSearchParams();
  const status = (search?.get("status") || "").toLowerCase();

  React.useEffect(() => {
    let cancelled = false;
    const fallbackTimer = setTimeout(() => {
      if (!cancelled) router.replace("/mensajes");
    }, 15000);
    (async () => {
      try {
        const res = await fetch(`/api/offers/${encodeURIComponent(params.id)}`, { credentials: "include", cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; conversationId?: string | null };
        const convId = typeof json?.conversationId === "string" && json.conversationId.length ? json.conversationId : null;
        if (status === "success") {
          // Best-effort: esperar a que el webhook marque el pago y garantice el mensaje en chat
          const started = Date.now();
          for (;;) {
            try {
              const pr = await fetch(`/api/offers/${encodeURIComponent(params.id)}/paid-message`, { method: "POST", credentials: "include" });
              const pj = (await pr.json().catch(() => ({}))) as { ok?: boolean; created?: boolean };
              if (pj?.ok) break;
            } catch {}
            if (Date.now() - started > 12000) break;
            await new Promise((r) => setTimeout(r, 800));
          }
        }
        if (convId) router.replace(`/mensajes/${convId}`);
        else router.replace("/mensajes");
      } catch {
        router.replace("/mensajes");
      } finally {
        clearTimeout(fallbackTimer);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, [router, params.id, status]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border p-6 bg-white shadow-sm text-center">
        {status === "success" ? (
          <>
            <h1 className="text-xl font-semibold">Pago procesado</h1>
            <p className="mt-2 text-sm text-slate-600">Redirigiendo al chat…</p>
            <div className="mt-4">
              <a href="/mensajes" className="inline-flex items-center rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">Ir a Mensajes</a>
            </div>
          </>
        ) : status === "cancel" ? (
          <>
            <h1 className="text-xl font-semibold">Pago cancelado</h1>
            <p className="mt-2 text-sm text-slate-600">Volviendo a tus mensajes…</p>
            <div className="mt-4">
              <a href="/mensajes" className="inline-flex items-center rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">Ir a Mensajes</a>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Oferta</h1>
            <p className="mt-2 text-sm text-slate-600">Redirigiendo…</p>
            <div className="mt-4">
              <a href="/mensajes" className="inline-flex items-center rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">Ir a Mensajes</a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

