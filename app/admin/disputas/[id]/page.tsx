"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StateBadge from "@/components/admin/state-badge";

type SupportCase = {
  id: string;
  subject: string | null;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  assigned_admin_id: string | null;
  sla_due_at: string | null;
  last_activity_at: string;
};

type EventItem = {
  id: number;
  kind: string;
  channel: string;
  author_type: string;
  body_text: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Context = {
  user?: { id: string; full_name?: string | null } | null;
  provider?: { id: string; full_name?: string | null } | null;
  request?: { id: string; title?: string | null } | null;
  agreement?: { id: string; status?: string | null } | null;
  payment?: {
    id: string;
    status?: string | null;
    amount?: number | null;
    currency?: string | null;
  } | null;
  assigned?: { id: string; full_name?: string | null } | null;
};

export default function AdminDisputaDetail({
  params,
}: {
  params: { id: string };
}) {
  const [data, setData] = useState<SupportCase | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [viewerAdminId, setViewerAdminId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [sendingWa, setSendingWa] = useState(false);

  useEffect(() => {
    void fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function fetchDetail() {
    const res = await fetch(`/api/admin/cases/${params.id}`, {
      cache: "no-store",
    });
    const j = await res.json();
    if (j.ok) {
      setData(j.case as SupportCase);
      setEvents(j.events as EventItem[]);
      setStatus((j.case as SupportCase)?.status || "");
      setPriority((j.case as SupportCase)?.priority || "");
      setContext(j.context as Context);
      setViewerAdminId((j.viewer_admin_id as string) || null);
    }
  }

  async function savePatch() {
    if (!data) return;
    setSaving(true);
    await fetch(`/api/admin/cases/${data.id}`, {
      method: "PATCH",
      headers: JSONH,
      body: JSON.stringify({ status, priority }),
    });
    setSaving(false);
    void fetchDetail();
  }

  async function addNote() {
    if (!note.trim()) return;
    await fetch(`/api/admin/cases/${params.id}/note`, {
      method: "POST",
      headers: JSONH,
      body: JSON.stringify({ body_text: note }),
    });
    setNote("");
    void fetchDetail();
  }

  async function assignMe() {
    if (!data || !viewerAdminId) return;
    setSaving(true);
    await fetch(`/api/admin/cases/${data.id}`, {
      method: "PATCH",
      headers: JSONH,
      body: JSON.stringify({ assigned_admin_id: viewerAdminId }),
    });
    setSaving(false);
    void fetchDetail();
  }

  async function sendWhatsApp() {
    if (!waMessage.trim() || !data) return;
    setSendingWa(true);
    await fetch(`/api/admin/cases/${data.id}/whatsapp/reply`, {
      method: "POST",
      headers: JSONH,
      body: JSON.stringify({ body_text: waMessage }),
    }).finally(() => setSendingWa(false));
    setWaMessage("");
    void fetchDetail();
  }

  const eventsByDate = events.reduce<Record<string, EventItem[]>>((acc, ev) => {
    const d = new Date(ev.created_at).toLocaleDateString();
    acc[d] = acc[d] || [];
    acc[d].push(ev);
    return acc;
  }, {});

  if (!data)
    return <div className="text-sm text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {data.subject || "Caso sin asunto"}
          </h1>
          <p className="text-sm text-muted-foreground">ID: {data.id}</p>
        </div>
        <StateBadge value={data.status} />
        <Badge variant="outline">{data.priority}</Badge>
        {data.sla_due_at ? (
          <Badge variant="secondary">
            SLA: {new Date(data.sla_due_at).toLocaleString()}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-2">
          <h2 className="text-sm font-semibold">Timeline</h2>
          <div className="space-y-4 rounded-md border p-3">
            {Object.entries(eventsByDate).map(([date, list]) => (
              <div key={date} className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  {date}
                </div>
                {list.map((ev) => (
                  <div
                    key={ev.id}
                    className="border rounded-md p-2 bg-white/60"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">
                        {ev.kind.replace("_", " ")}
                      </span>
                      <span>·</span>
                      <span>{ev.channel}</span>
                      <span>·</span>
                      <span>
                        {new Date(ev.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {ev.body_text ? (
                      <p className="text-sm mt-1">{ev.body_text}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-xs text-muted-foreground">Sin eventos</div>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="text-sm font-semibold">Actualizar</h3>
            <label className="text-xs text-muted-foreground">Estatus</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="nuevo">Nuevo</option>
              <option value="en_proceso">En proceso</option>
              <option value="esperando_cliente">Esperando cliente</option>
              <option value="resuelto">Resuelto</option>
              <option value="cerrado">Cerrado</option>
            </select>
            <label className="text-xs text-muted-foreground">Prioridad</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
            <Button size="sm" onClick={savePatch} disabled={saving}>
              Guardar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={assignMe}
              disabled={saving || !viewerAdminId}
            >
              Asignarme
            </Button>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="text-sm font-semibold">Agregar nota</h3>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota interna"
            />
            <Button size="sm" onClick={addNote} disabled={!note.trim()}>
              Publicar nota
            </Button>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="text-sm font-semibold">Responder WhatsApp</h3>
            <Textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              placeholder="Mensaje al cliente"
            />
            <Button
              size="sm"
              onClick={sendWhatsApp}
              disabled={!waMessage.trim() || sendingWa}
            >
              Enviar
            </Button>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="text-sm font-semibold">Descripción</h3>
            <p className="text-sm whitespace-pre-line">
              {data.description || "Sin descripción"}
            </p>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="text-sm font-semibold">Contexto</h3>
            <ContextRow
              label="Usuario"
              value={context?.user?.full_name || context?.user?.id}
            />
            <ContextRow
              label="Profesional"
              value={context?.provider?.full_name || context?.provider?.id}
            />
            <ContextRow label="Request" value={context?.request?.id} />
            <ContextRow label="Agreement" value={context?.agreement?.id} />
            <ContextRow label="Payment" value={context?.payment?.id} />
            <ContextRow
              label="Asignado"
              value={context?.assigned?.full_name || context?.assigned?.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const JSONH = { "Content-Type": "application/json; charset=utf-8" };

function ContextRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="text-xs">
      <span className="font-semibold">{label}: </span>
      <span className="text-muted-foreground">{value || "—"}</span>
    </div>
  );
}
