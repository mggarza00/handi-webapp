'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';

type Item = {
  id: string;
  bank_name: string | null;
  clabe_masked: string | null;
  status: string;
  is_default: boolean;
};

type Props = {
  profileFullName: string;
  initialItems: Item[];
};

function onlyDigits(s: string) { return (s || '').replace(/\D+/g, ''); }
function clabePretty(v: string) { return onlyDigits(v).slice(0, 18).replace(/(.)/g, '$1 ').trim(); }

const BANK_CODES: Record<string, string> = {
  '002': 'Citibanamex', '006': 'Banco del Bajío', '009': 'BBVA', '012': 'BBVA', '014': 'Santander', '019': 'BanRegio', '021': 'HSBC',
  '030': 'Banco del Bajío', '032': 'IXE', '036': 'Inbursa', '044': 'Scotiabank', '058': 'Banamex (old)', '059': 'Invex', '062': 'Afirme',
  '072': 'Banorte', '127': 'Azteca', '128': 'Banamex (wallet)', '136': 'Intercam', '137': 'BanCoppel', '138': 'BanCoppel',
};

export default function ProBankAccountsManager({ profileFullName, initialItems }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [bank, setBank] = useState('');
  const [clabe, setClabe] = useState('');
  const [bankEdited, setBankEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clabeDigits = useMemo(() => onlyDigits(clabe), [clabe]);

  // Auto-detect bank once from CLABE prefix if user hasn't typed
  useEffect(() => {
    const code = clabeDigits.slice(0, 3);
    const suggestion = BANK_CODES[code] || '';
    if (!bankEdited && suggestion && bank.trim().length === 0) setBank(suggestion);
  }, [clabeDigits, bank, bankEdited]);

  async function refresh() {
    try {
      const res = await fetch('/api/bank-accounts', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { items?: Item[] };
      if (Array.isArray(json?.items)) setItems(json.items);
    } catch {
      // ignore
    }
  }

  function onClickEdit() {
    // Si está en edición, el botón guarda/cierra; si no, entra a edición
    if (editMode) {
      setEditMode(false);
      setAdding(false);
    } else {
      setEditMode(true);
    }
    setError(null);
  }

  function onAddNew() {
    setAdding(true);
    setBank('');
    setClabe('');
    setBankEdited(false);
    setError(null);
  }

  async function onSaveNew(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const b = bank.trim(); const c = clabeDigits;
    if (!b) { setError('Completa el banco'); return; }
    if (!/^\d{18}$/.test(c)) { setError('CLABE inválida (18 dígitos)'); return; }
    startTransition(async () => {
      const res = await fetch('/api/bank-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ bank: b, clabe: c }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || 'No se pudo guardar');
        return;
      }
      setAdding(false);
      await refresh();
    });
  }

  async function onSelectDefault(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/bank-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ is_default: true }),
      });
      if (res.ok) await refresh();
    });
  }

  return (
    <section className="rounded-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cuentas bancarias (Profesional)</h2>
        <button
          onClick={onClickEdit}
          className={
            editMode
              ? 'rounded-md bg-sky-600 text-white text-sm px-3 py-1 hover:bg-sky-700'
              : 'rounded-md border border-sky-600 text-sky-700 text-sm px-3 py-1 hover:bg-sky-50'
          }
        >
          {editMode ? 'Guardar cambios' : 'Editar'}
        </button>
      </div>

      {/* Mostrar todas las cuentas cuando no está en edición */}
      {!editMode ? (
        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-600">Aún no tienes cuentas guardadas.</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="border rounded-xl p-3">
                {it.is_default ? (
                  <div className="mb-2">
                    <span className="inline-block text-xs font-medium text-white bg-sky-600 rounded px-2 py-0.5">
                      Cuenta predeterminada
                    </span>
                  </div>
                ) : null}
                <div className="text-sm text-gray-700">Titular: <span className="font-medium">{profileFullName}</span></div>
                <div className="text-sm text-gray-700">Banco: <span className="font-medium">{it.bank_name || '—'}</span></div>
                <div className="text-sm text-gray-700">CLABE: <span className="font-mono">{it.clabe_masked || '****************'}</span></div>
                <div className="text-xs text-gray-500">Nunca mostramos tu CLABE completa.</div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* Edit mode: list all accounts + default selector */}
      {editMode ? (
        <div className="mt-4 space-y-3">
          {items.map((it) => (
            <div key={it.id} className="border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">Banco: <span className="font-medium">{it.bank_name || '—'}</span></div>
                  <div className="text-xs text-gray-600">CLABE: <span className="font-mono">{it.clabe_masked || '****************'}</span></div>
                </div>
                <div className="ml-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={it.is_default}
                      onChange={() => onSelectDefault(it.id)}
                    />
                    Seleccionar como predeterminada
                  </label>
                </div>
              </div>
            </div>
          ))}

          <div className="pt-2">
            <button onClick={onAddNew} className="rounded-md border px-3 py-1 hover:bg-muted">Agregar nueva cuenta</button>
          </div>

          {adding ? (
            <form className="mt-3 space-y-3" onSubmit={onSaveNew}>
              <div>
                <label className="block text-sm mb-1">Nombre (titular)</label>
                <input className="w-full border rounded-md p-2 bg-muted" value={profileFullName} disabled />
              </div>
              <div>
                <label className="block text-sm mb-1">CLABE (18 dígitos)</label>
                <input
                  className="w-full border rounded-md p-2"
                  value={clabePretty(clabe)}
                  onChange={(e) => setClabe(e.target.value)}
                  maxLength={23}
                />
                <p className="text-xs text-muted-foreground mt-1">Mostramos solo algunos dígitos y el resto con asteriscos.</p>
              </div>
              <div>
                <label className="block text-sm mb-1">Banco</label>
                <input
                  className="w-full border rounded-md p-2"
                  value={bank}
                  onChange={(e) => { setBank(e.target.value); setBankEdited(true); }}
                />
              </div>
              {error ? <p className="text-xs text-rose-700">{error}</p> : null}
              <button type="submit" disabled={pending} className="rounded-xl border px-3 py-1">
                {pending ? 'Guardando' : 'Guardar'}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
