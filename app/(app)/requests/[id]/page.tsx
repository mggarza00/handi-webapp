import { headers } from 'next/headers';

type RequestRow = {
  id: string; title: string; description: string; city: string;
  category: string; subcategory: string; budget: number; required_at: string;
  status: string; created_by: string; created_at: string;
};

export default async function RequestDetail({ params }: { params: { id: string } }) {
  const hdrs = headers();
  const host = hdrs.get('host');
  const base = `${process.env.VERCEL ? 'https' : 'http'}://${host}`;
  const res = await fetch(`${base}/api/requests/${params.id}`, { cache: 'no-store' });

  if (!res.ok) {
    return <div className="text-red-600">Solicitud no encontrada.</div>;
  }

  const { data }: { data: RequestRow } = await res.json();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{data.title}</h2>

      <div className="rounded-2xl border p-4 space-y-2 text-sm">
        <div><span className="text-neutral-500">Descripción: </span>{data.description}</div>
        <div><span className="text-neutral-500">Categoría: </span>{data.category}</div>
        <div><span className="text-neutral-500">Subcategoría: </span>{data.subcategory}</div>
        <div><span className="text-neutral-500">Municipio: </span>{data.city}</div>
        <div><span className="text-neutral-500">Fecha requerida: </span>{data.required_at || '—'}</div>
        <div><span className="text-neutral-500">Estado: </span>{data.status}</div>
        <div><span className="text-neutral-500">Honorarios: </span>${data.budget?.toLocaleString?.() || data.budget} MXN</div>
      </div>

      <div className="rounded-2xl border p-4">
        <div className="font-semibold mb-2">Prospectos</div>
        <div className="text-sm text-neutral-500">Conectamos a la hoja “applications” en el siguiente paso.</div>
      </div>
    </div>
  );
}
