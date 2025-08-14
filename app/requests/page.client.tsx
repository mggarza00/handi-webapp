"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type RequestRow = {
  id: string;
  title: string;
  city: string | null;
  category: string | null;
  subcategory: string | null;
  created_at: string;
  status: "active" | "closed";
};

function StatusBadge({ status }: { status: "active" | "closed" }) {
  const cls = status === "active" ? "bg-green-600" : "bg-gray-600";
  const label = status === "active" ? "active" : "closed";
  return <span className={`text-xs px-2 py-1 rounded text-white ${cls}`}>{label}</span>;
}

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStatus = useMemo(() => {
    const s = (searchParams.get("status") || "active").toLowerCase();
    return (["active","closed","all"].includes(s) ? s : "active") as "active"|"closed"|"all";
  }, [searchParams]);
  const initialMineOnly = useMemo(() => searchParams.get("mine") === "1", [searchParams]);

  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"active" | "closed" | "all">(initialStatus);
  const [mineOnly, setMineOnly] = useState<boolean>(initialMineOnly);

  useEffect(() => {
    const sp = new URLSearchParams();
    sp.set("status", status);
    if (mineOnly) sp.set("mine", "1");
    router.replace(`/requests?${sp.toString()}`);
  }, [status, mineOnly, router]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/requests?limit=20&page=1&status=${status}${mineOnly ? "&mine=1" : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudieron cargar solicitudes");
      setItems(json.data || []);
    } catch (e:any) { setError(e?.message || "Error de red"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, mineOnly]);

  const Tab = ({value,label}:{value:"active"|"closed"|"all";label:string}) => (
    <button onClick={()=>setStatus(value)} className={`px-3 py-1 rounded border ${status===value ? "bg-black text-white" : "bg-white"}`}>{label}</button>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Solicitudes</h1>
        <a href="/requests/new" className="px-3 py-2 rounded bg-black text-white">Nueva solicitud</a>
      </div>

      <div className="flex items-center gap-2">
        <Tab value="active" label="Activas" />
        <Tab value="closed" label="Cerradas" />
        <Tab value="all" label="Todas" />
        <label className="ml-4 text-sm flex items-center gap-2">
          <input type="checkbox" checked={mineOnly} onChange={e=>setMineOnly(e.target.checked)} />
          Solo mis solicitudes
        </label>
      </div>

      {loading && <p>Cargando…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && items.length === 0 && <p className="text-gray-600">No hay solicitudes para este filtro.</p>}

      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className="border rounded p-3">
            <div className="flex items-center justify-between gap-3">
              <a href={`/requests/${r.id}`} className="font-medium underline">{r.title}</a>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              {r.category || "—"} / {r.subcategory || "—"} {r.city ? `· ${r.city}` : ""}
            </p>
            <div className="mt-2 flex gap-2">
              <a href={`/requests/${r.id}`} className="px-3 py-1 rounded bg-black text-white">Ver detalle</a>
              <button className="px-3 py-1 rounded border" onClick={() => { navigator.clipboard.writeText(r.id); alert("Request ID copiado."); }}>
                Copiar ID
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
