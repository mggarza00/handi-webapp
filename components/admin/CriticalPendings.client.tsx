"use client";
import { useEffect, useState } from "react";

type KycItem = { id: string; user_id: string; status: string; updated_at: string | null };
type DisputeItem = { id: string; amount: number; currency: string; created_at: string };

export default function CriticalPendings() {
  const [kyc, setKyc] = useState<KycItem[]>([]);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const r = await fetch('/api/admin/critical', { cache: 'no-store' });
      const j = await r.json();
      setKyc(j.kycPending || []);
      setDisputes(j.disputesNew || []);
      setLoading(false);
    })();
  }, []);

  return (
    <section className="rounded-xl border p-4">
      <div className="mb-2 text-lg font-semibold">Pendientes críticos</div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm opacity-70">KYC pendientes</div>
            {kyc.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin pendientes</div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {kyc.slice(0, 5).map((k) => (
                  <li key={k.id} className="px-3 py-2 text-sm">
                    <div className="font-medium">{k.user_id}</div>
                    <div className="text-muted-foreground">{k.updated_at ? new Date(k.updated_at).toLocaleString() : '—'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-2 text-sm opacity-70">Disputas nuevas (7d)</div>
            {disputes.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin disputas</div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {disputes.slice(0, 5).map((d) => (
                  <li key={d.id} className="px-3 py-2 text-sm">
                    <div className="font-medium">{d.id} • {d.amount.toLocaleString()} {d.currency}</div>
                    <div className="text-muted-foreground">{new Date(d.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

