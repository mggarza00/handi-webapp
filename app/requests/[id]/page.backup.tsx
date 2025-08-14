"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Req = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  category: string | null;
  subcategory: string | null;
  budget: number | null;
  status: "active" | "closed";
  created_at: string;
  created_by: string;
};
type AppRow = {
  id: string;
  cover_letter: string | null;
  proposed_budget: number | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  professional: { id: string; headline: string | null; rating: number | null; skills: string[] | null } | null;
};
type ApiRes<T=any> = { ok: boolean; data?: T; error?: string };

function StatusBadge({ status }: { status: "active" | "closed" }) {
  const cls = status === "active" ? "bg-green-600" : "bg-gray-600";
  const label = status === "active" ? "active" : "closed";
  return <span className={`text-xs px-2 py-1 rounded text-white ${cls}`}>{label}</span>;
}

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [data, setData] = useState<Req | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const [applied, setApplied] = useState(false);
  const [checking, setChecking] = useState(true);

  const [meId, setMeId] = useState<string | null>(null);
  const [apps, setApps] = useState<AppRow[]>([]);
  const isOwner = !!(meId && data && data.created_by === meId);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/requests/${id}`);
      const json: ApiRes<Req> = await res.json();
      if (!json.ok) throw new Error(json.error || "No se encontró la solicitud");
      setData(json.data!);
    } catch (e:any) { setMsg(e?.message || "Error de red"); }
    finally { setLoading(false); }
  }
  async function loadMe() {
    try { const m = await fetch("/api/me").then(r => r.ok ? r.json() : null); if (m?.ok && m.user?.id) setMeId(m.user.id); } catch {}
  }
  async function loadApps() {
    try { const r = await fetch(`/api/requests/${id}/applications`).then(r=>r.json()); if (r?.ok) setApps(r.data || []); } catch {}
  }
  async function checkApplied() {
    setChecking(true);
    try { const r = await fetch(`/api/applications/my?requestId=${id}`).then(r=>r.json()); if (r?.ok) setApplied(!!r.data); }
    finally { setChecking(false); }
  }

  async function postularme() {
    if (!data) return;
    setPosting(true); setMsg(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ requestId: data.id, coverLetter: "Puedo apoyar con este trabajo.", proposedBudget: data.budget ?? undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo postular");
      setMsg("✅ Postulación enviada."); setApplied(true);
      if (isOwner) await loadApps();
    } catch (e:any) { setMsg(e?.message || "Error al postular"); }
    finally { setPosting(false); }
  }

  async function cambiarEstado(appId: string, status: "accepted" | "rejected") {
    setMsg(null);
    const res = await fetch(`/api/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!json.ok) { setMsg(json.error || "No se pudo actualizar la postulación"); return; }
    await Promise.all([load(), loadApps()]);
    if (status === "accepted") router.push("/requests?status=closed&mine=1");
  }

  async function reabrir() {
    if (!data) return;
    setMsg(null);
    const res = await fetch(`/api/requests/${data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ status: "active" }),
    });
    const json = await res.json();
    if (!json.ok) { setMsg(json.error || "No se pudo reabrir"); return; }
    await load();
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { checkApplied(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { loadMe(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (isOwner) loadApps(); /* eslint-disable-next-line */ }, [isOwner, id]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <a href="/requests" className="text-blue-600 underline">&larr; Volver</a>

      {loading && <p>Cargando…</p>}
      {msg && <div className="rounded border p-3 bg-gray-50 text-sm">{msg}</div>}

      {data && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold">{data.title}</h1>
            <div className="flex items-center gap-2">
              <StatusBadge status={data.status} />
              <span className="text-xs text-gray-500">{new Date(data.created_at).toLocaleString()}</span>
            </div>
          </div>

          <p className="text-gray-700 whitespace-pre-wrap">{data.description || "Sin descripción"}</p>

          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div><span className="text-gray-500">Categoría:</span> {data.category || "—"}</div>
            <div><span className="text-gray-500">Subcategoría:</span> {data.subcategory || "—"}</div>
            <div><span className="text-gray-500">Ciudad:</span> {data.city || "—"}</div>
            <div><span className="text-gray-500">Presupuesto:</span> {data.budget != null ? `\$${data.budget}` : "—"}</div>
            <div><span className="text-gray-500">ID:</span> <code className="font-mono">{data.id}</code></div>
          </div>

          {/* Acción de reabrir (solo dueño y si está cerrada) */}
          {isOwner && data.status === "closed" && (
            <div className="pt-2">
              <button onClick={reabrir} className="px-3 py-2 rounded bg-blue-600 text-white">
                Reabrir solicitud
              </button>
            </div>
          )}

          {/* Acción de postular (si NO soy dueño) */}
          {!isOwner && (
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={postularme}
                disabled={posting || data.status !== "active" || applied || checking}
                className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
              >
                {checking ? "Verificando…" : applied ? "Ya postulaste" : posting ? "Postulando…" : "Postularme"}
              </button>
              {applied && <span className="text-sm text-green-700">Ya existe una postulación para esta solicitud.</span>}
            </div>
          )}

          {/* Postulaciones recibidas (solo dueño) */}
          {isOwner && (
            <div className="pt-4">
              <h2 className="text-lg font-semibold mb-2">Postulaciones recibidas ({apps.length})</h2>
              {apps.length === 0 && <p className="text-gray-600 text-sm">Aún no hay postulaciones.</p>}
              <ul className="space-y-3">
                {apps.map((a) => (
                  <li key={a.id} className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{a.professional?.headline || "Profesional"}</div>
                      <span className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{a.cover_letter || "Sin mensaje"}</p>
                    <div className="text-sm text-gray-600 mt-2 flex items-center gap-3">
                      <span>Propuesta: {a.proposed_budget != null ? `\$${a.proposed_budget}` : "—"}</span>
                      <span>Estatus: <b>{a.status}</b></span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => cambiarEstado(a.id, "accepted")} disabled={a.status === "accepted"} className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50">Aceptar</button>
                      <button onClick={() => cambiarEstado(a.id, "rejected")} disabled={a.status === "rejected"} className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50">Rechazar</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
