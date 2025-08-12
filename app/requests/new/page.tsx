'use client';
import { useState } from 'react';

export default function NewRequest() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');
  const [budget, setBudget] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true); setOk(null); setErr(null);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: desc,
          city,
          category,
          subcategory: '',
          budget: Number(budget || 0),
          required_at: date,
          status: 'active',
          created_by: 'user_demo'
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al crear');

      setOk(`Creada: ${json.data.id}`);
      // Opcional: redirige al detalle
      // window.location.href = `/requests/${json.data.id}`;
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* ...tus inputs existentes (title/category/desc/budget/city/date) ... */}
      <button
        className="h-10 px-4 rounded-2xl bg-brand text-white disabled:opacity-50"
        onClick={onSubmit}
        disabled={loading}
      >
        {loading ? 'Guardando…' : 'Crear solicitud'}
      </button>
      {ok && <div className="text-green-600 text-sm mt-2">{ok}</div>}
      {err && <div className="text-red-600 text-sm mt-2">{err}</div>}
    </div>
  );
}
