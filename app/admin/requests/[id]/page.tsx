import Link from "next/link";

export const dynamic = "force-dynamic";

async function getData(id: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const res = await fetch(`${base}/api/admin/requests/${id}`, { cache: 'no-store' });
  return res.json();
}

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const { request, payments } = await getData(params.id);
  if (!request) return <div className="text-sm text-muted-foreground">No encontrado</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Solicitud #{params.id.slice(0,8)}</h2>
        <Link href="/admin/requests" className="text-sm text-primary">← Volver</Link>
      </div>
      <div className="rounded-xl border p-4">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div><span className="opacity-70">Ciudad: </span>{request.city || '—'}</div>
          <div><span className="opacity-70">Categoría: </span>{request.category || '—'}</div>
          <div><span className="opacity-70">Presupuesto: </span>{request.budget ?? '—'}</div>
          <div><span className="opacity-70">Fecha: </span>{request.created_at ? new Date(request.created_at).toLocaleString() : '—'}</div>
          <div><span className="opacity-70">Estado: </span>{request.status}</div>
        </div>
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-2 text-sm opacity-70">Pagos relacionados</div>
        {Array.isArray(payments) && payments.length > 0 ? (
          <ul className="divide-y">
            {payments.map((p: { id: string; amount: number; currency: string; status: string; created_at: string }) => (
              <li key={p.id} className="py-2 text-sm">
                {p.id} • {Number(p.amount).toLocaleString()} {p.currency} • {p.status} • {new Date(p.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">Sin pagos</div>
        )}
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-2 text-sm opacity-70">Timeline</div>
        <div className="text-sm text-muted-foreground">(stub) Mostrar cambios de estado y eventos relevantes</div>
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-2 text-sm opacity-70">Notas</div>
        <div className="text-sm text-muted-foreground">(stub) Notas internas</div>
      </div>
    </div>
  );
}
