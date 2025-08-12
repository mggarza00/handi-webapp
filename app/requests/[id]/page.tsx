import Link from "next/link";

async function fetchRequest(id: string) {
  const res = await fetch(`/api/requests/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

function Row({ label, value }: { label: string; value?: any }) {
  return (
    <div className="flex gap-3">
      <div className="w-40 shrink-0 text-neutral-500">{label}</div>
      <div className="flex-1">{value ?? ""}</div>
    </div>
  );
}

function fmtDate(d?: string) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return dt.toLocaleString("es-MX", { hour12: false });
  } catch { return d; }
}

export default async function RequestDetail({ params }: { params: { id: string } }) {
  const item = await fetchRequest(params.id);

  if (!item) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <Link href="/requests" className="text-sm underline">← Volver</Link>
        <h1 className="text-2xl font-semibold mt-4">Solicitud no encontrada</h1>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <Link href="/requests" className="text-sm underline">← Volver</Link>

      <h1 className="text-2xl font-semibold mt-4 mb-4">{item.title || "(sin título)"}</h1>

      <div className="space-y-3 bg-white p-6 rounded-xl border">
        <Row label="Descripción" value={item.description} />
        <Row label="Ciudad" value={item.city} />
        <Row label="Categoría" value={item.category} />
        <Row label="Subcategoría" value={item.subcategory} />
        <Row label="Presupuesto" value={item.budget} />
        <Row label="Fecha requerida" value={item.required_at} />
        <Row label="Estado" value={item.status} />
        <Row label="Creado por" value={item.created_by} />
        <Row label="Creado" value={fmtDate(item.created_at)} />
        <Row label="Actualizado" value={fmtDate(item.updated_at)} />
        <Row label="ID" value={item.id} />
      </div>
    </main>
  );
}
