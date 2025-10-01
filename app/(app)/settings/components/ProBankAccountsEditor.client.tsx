'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';

type Props = {
  profileFullName: string;
  initialBankName: string | null;
  maskedClabe: string | null;
  hasAccount: boolean;
};

function onlyDigits(s: string) { return (s || '').replace(/\D+/g, ''); }
function clabePretty(v: string) { return onlyDigits(v).slice(0, 18).replace(/(.)/g, '$1 ').trim(); }
//

const BANK_CODES: Record<string, string> = {
  '002': 'Citibanamex',
  '006': 'Banco del Bajío',
  '009': 'BBVA',
  '012': 'BBVA',
  '014': 'Santander',
  '019': 'BanRegio',
  '021': 'HSBC',
  '030': 'Banco del Bajío',
  '032': 'IXE',
  '036': 'Inbursa',
  '044': 'Scotiabank',
  '058': 'Banamex (old)',
  '059': 'Invex',
  '062': 'Afirme',
  '072': 'Banorte',
  '127': 'Azteca',
  '128': 'Banamex (wallet)',
  '136': 'Intercam',
  '137': 'BanCoppel',
  '138': 'BanCoppel',
};

export default function ProBankAccountsEditor({ profileFullName, initialBankName, maskedClabe, hasAccount }: Props) {
  const [showForm, setShowForm] = useState<boolean>(!hasAccount);
  const [hasAcc, setHasAcc] = useState<boolean>(hasAccount);
  const [bank, setBank] = useState<string>(initialBankName ?? '');
  const [bankEdited, setBankEdited] = useState<boolean>(false);
  const [masked, setMasked] = useState<string | null>(maskedClabe);
  const [clabe, setClabe] = useState<string>('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const clabeDigits = useMemo(() => onlyDigits(clabe), [clabe]);
  const hasClabe = clabeDigits.length > 0;

  // Auto-fill bank once from CLABE prefix if user hasn't typed bank explicitly
  useEffect(() => {
    const prefix = clabeDigits.slice(0, 3);
    const suggestion = BANK_CODES[prefix] || '';
    if (!bankEdited && suggestion && bank.trim().length === 0) {
      setBank(suggestion);
    }
  }, [clabeDigits, bankEdited, bank]);

  async function refreshAfterSave() {
    try {
      const res = await fetch('/api/bank-accounts', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { bank?: string | null; clabe?: string | null };
      setShowForm(false);
      setHasAcc(true);
      setBank((json?.bank ?? '') as string);
      setMasked((json?.clabe ?? null) as string | null);
      setClabe('');
    } catch {
      // ignore
    }
  }

  async function save() {
    setError(null);
    try {
      const chosenBank = bank?.trim() || '';
      const payload = {
        account_holder_name: profileFullName.trim(),
        bank_name: chosenBank,
        clabe: clabeDigits,
      } as const;
      if (!payload.account_holder_name || !payload.bank_name) {
        setError('Completa titular y banco');
        return;
      }
      if (!/^\d{18}$/.test(payload.clabe)) {
        setError('CLABE inválida (18 dígitos)');
        return;
      }
      const res = await fetch('/api/bank-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ bank: payload.bank_name, clabe: payload.clabe }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        setError(json?.error || 'No se pudo guardar la cuenta');
        return;
      }
      await refreshAfterSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save_failed');
    } finally {
      // no-op
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await save();
      setHasAcc(true);
    });
  }

  const modeLabel = hasAcc ? (showForm ? 'Editar' : 'Editar') : 'Agregar una cuenta';

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cuentas bancarias (Profesional)</h3>
        <span className="text-xs text-muted-foreground">{modeLabel}</span>
      </div>

      {error ? (<p className="mt-2 text-sm text-rose-700">{error}</p>) : null}

      {hasAcc && !showForm ? (
        <div className="mt-4 space-y-1">
          <div className="text-sm text-gray-700">Titular: <span className="font-medium">{profileFullName}</span></div>
          <div className="text-sm text-gray-700">Banco: <span className="font-medium">{bank || initialBankName || '—'}</span></div>
          <div className="text-sm text-gray-700">CLABE: <span className="font-mono">{masked ?? '****************'}</span></div>
          <div className="text-xs text-gray-500">Nunca mostramos tu CLABE completa.</div>
          <div className="pt-2">
            <button onClick={() => setShowForm(true)} className="rounded-xl border px-3 py-1">Editar</button>
          </div>
        </div>
      ) : null}

      {!hasAcc || showForm ? (
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm mb-1">Nombre (titular)</label>
            <input className="w-full border rounded-md p-2 bg-muted" value={profileFullName} disabled />
          </div>
          <div>
            <label className="block text-sm mb-1">CLABE (18 dígitos)</label>
            <input
              className="w-full border rounded-md p-2"
              placeholder={hasAcc && !hasClabe ? (masked ?? `***${'*'.repeat(18 - 7)}${'****'}`) : 'CLABE (18 dígitos)'}
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
          <button type="submit" disabled={pending} className="mt-2 rounded-xl px-4 py-2 border">
            {pending ? 'Guardando' : 'Guardar'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
