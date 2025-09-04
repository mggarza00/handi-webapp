"use client";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMessagesThread } from "@/lib/hooks/useMessagesThread";
import { useSendMessage } from "@/lib/hooks/useSendMessage";

type Props = { requestId: string; createdBy: string | null };

export default function ChatClient({ requestId, createdBy }: Props) {
  const [apps, setApps] = React.useState<Array<Record<string, unknown>>>([]);
  const [peerId, setPeerId] = React.useState<string>("");
  const [me, setMe] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const { data: messages, loading, reload } = useMessagesThread(requestId, { limit: 50 });
  const { send, loading: sending, error } = useSendMessage();

  React.useEffect(() => {
    // Obtener usuario actual para preseleccionar peer
    (async () => {
      try {
        const r = await fetch(`/api/me`, { headers: { "Content-Type": "application/json; charset=utf-8" }, cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { ok: boolean; user?: { id: string } };
        if (j?.ok && j.user?.id) setMe(j.user.id);
      } catch {
        // no-op
      }
    })();

    (async () => {
      const res = await fetch(`/api/requests/${requestId}/applications`, {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { ok: boolean; data?: Array<Record<string, unknown>> };
      const rows: Array<Record<string, unknown>> = json?.data ?? [];
      setApps(rows);
      const firstId = (rows[0]?.professional_id as string | undefined) ?? "";
      // Preselección: si el usuario actual no es el dueño, chatea con el dueño; si es el dueño y hay un único pro, seleccionarlo
      if (me && createdBy && me !== createdBy) {
        setPeerId(createdBy);
      } else if (rows.length === 1 && firstId) {
        setPeerId(firstId);
      }
    })();
  }, [requestId, createdBy, me]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!peerId) return;
    const t = text.trim();
    if (!t) return;
    await send({ request_id: requestId, to_user_id: peerId, text: t }).catch(() => {});
    setText("");
    reload();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-700">Conversar con:</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={peerId}
          onChange={(e) => setPeerId(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {apps.map((a) => (
            <option key={(a.id as string) ?? String(a.professional_id)} value={(a.professional_id as string) ?? ""}>
              {(a.pro_full_name as string) ?? (a.professional_id as string)}
            </option>
          ))}
          {createdBy && (
            <option value={createdBy}>Cliente (dueño)</option>
          )}
        </select>
      </div>

      <div className="border rounded h-64 overflow-y-auto p-3 bg-white">
        {loading ? (
          <p className="text-sm text-gray-600">Cargando…</p>
        ) : (
          <ul className="space-y-2">
            {(messages ?? [])
              .slice()
              .reverse()
              .map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="text-gray-500 mr-2">{new Date(m.created_at).toLocaleString()}</span>
                  <span>{m.text}</span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSend} className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje (sin datos personales)"
        />
        <Button type="submit" disabled={!peerId || sending}>
          {sending ? "Enviando…" : "Enviar"}
        </Button>
      </form>
      {error && <p className="text-xs text-red-600">{error.message}</p>}
    </div>
  );
}
