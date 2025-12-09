"use client";
import { useEffect, useState } from "react";

type Webhook = { id: string; provider: string; event: string; status_code: number; created_at: string };
type Audit = { id: string; action: string; actor_id: string; entity?: string | null; entity_id?: string | null; created_at: string };

export default function AdminSystemPage() {
  const [tab, setTab] = useState<"webhooks" | "audit">("webhooks");
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchData(); }, [tab]);
  async function fetchData() {
    setLoading(true);
    if (tab === 'webhooks') {
      const p = new URLSearchParams(); if (provider) p.set('provider', provider); if (status) p.set('status', status);
      const w = await fetch(`/api/webhooks-log?${p.toString()}`, { cache: 'no-store' }).then((r) => r.json());
      setWebhooks((w.items || []) as Webhook[]);
    } else {
      const a = await fetch(`/api/audit-log`, { cache: 'no-store' }).then((r) => r.json());
      setAudits((a.items || []) as Audit[]);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border p-1">
        <button onClick={() => setTab("webhooks")} className={`px-3 py-1.5 text-sm rounded-md ${tab === "webhooks" ? "bg-primary text-primary-foreground" : ""}`}>Webhooks</button>
        <button onClick={() => setTab("audit")} className={`px-3 py-1.5 text-sm rounded-md ${tab === "audit" ? "bg-primary text-primary-foreground" : ""}`}>Audit log</button>
      </div>
      {tab === "webhooks" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input placeholder="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} className="h-9 w-40 rounded-md border px-3 text-sm" />
            <input placeholder="Status code" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-36 rounded-md border px-3 text-sm" />
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void fetchData()}>Aplicar</button>
          </div>
          {loading ? <div className="text-sm text-muted-foreground">Cargando…</div> : (
            <ul className="divide-y rounded-xl border">
              {webhooks.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="font-mono text-xs">{w.provider}</div>
                  <div className="min-w-0 flex-1 truncate">{w.event}</div>
                  <div className={`text-xs ${w.status_code < 400 ? "text-emerald-600" : "text-red-600"}`}>{w.status_code}</div>
                  <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {loading ? <div className="text-sm text-muted-foreground">Cargando…</div> : (
            <ul className="divide-y rounded-xl border">
              {audits.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="font-mono text-xs">{a.action}</div>
                  <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{a.entity || '—'} {a.entity_id || ''}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


