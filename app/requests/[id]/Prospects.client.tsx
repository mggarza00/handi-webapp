/* eslint-disable import/order */
"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProspects } from "@/lib/hooks/useProspects";
import ChatPanel from "@/components/chat/ChatPanel";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Props = { requestId: string };

export default function ProspectsClient({ requestId }: Props) {
  const router = useRouter();
  const { data, loading, error } = useProspects(requestId);
  const [creating, setCreating] = React.useState<string | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<string | null>(null);
  const [requestBudget, setRequestBudget] = React.useState<number | null>(null);
  const [amountEdits, setAmountEdits] = React.useState<Record<string, string>>(
    {},
  );
  const supabase = createSupabaseBrowser();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/requests/${requestId}`, {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          cache: "no-store",
          credentials: "include",
        });
        const j = await r.json();
        if (!cancelled && r.ok) {
          const b = Number(j?.data?.budget ?? NaN);
          if (Number.isFinite(b)) setRequestBudget(b);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // Obtener usuario actual para deshabilitar "Enviar mensaje" si es el mismo pro
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled && data?.user?.id) setMe(data.user.id);
      } catch {
        /* ignore */
      }
      try {
        const r = await fetch(`/api/me`, { cache: "no-store", credentials: "include" });
        const j = await r.json();
        if (!cancelled && r.ok && j?.user?.id) setMe(j.user.id as string);
      } catch {
        // ignore unauth
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (loading)
    return <p className="text-sm text-gray-600">Cargando prospectos…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  const items = Array.isArray(data) ? data : [];

  if (!items.length)
    return <p className="text-sm text-gray-600">Sin prospectos todavía.</p>;

  return (
    <>
    <ul className="space-y-3">
      {items.map((p: Record<string, unknown>) => (
        <li
          key={(p.professional_id as string) ?? (p.id as string)}
          className="border rounded p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium flex items-center gap-2">
                <Link
                  href={`/profiles/${(p.professional_id as string) ?? ""}`}
                  className="hover:underline"
                >
                  {(p.full_name as string) ??
                    (p.pro_full_name as string) ??
                    "Profesional"}
                </Link>
                {((p.is_featured as boolean) ?? false) && (
                  <Badge>Destacado</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {(p.headline as string) ?? (p.pro_headline as string) ?? ""}
              </p>
            </div>
            <div className="text-sm text-gray-700">
              ⭐{" "}
              {(p.rating as string | number) ??
                (p.pro_rating as string | number) ??
                "—"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/profiles/${(p.professional_id as string) ?? ""}`}>
                Ver perfil
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const proId = (p.professional_id as string) ?? "";
                if (!proId) return;
                // Si no está autenticado, redirigir a login
                if (!me) {
                  const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
                  router.push(`/auth/sign-in?next=${encodeURIComponent(here)}`);
                  return;
                }
                if (me === proId) return;
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const res = await fetch(`/api/chat/start`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json; charset=utf-8",
                      ...(session?.access_token
                        ? { Authorization: `Bearer ${session.access_token}` }
                        : {}),
                      ...(session?.access_token
                        ? { "x-access-token": session.access_token }
                        : {}),
                      ...(me ? { "x-user-id": me } : {}),
                    },
                    credentials: "include",
                    body: JSON.stringify({ requestId, proId }),
                  });
                  const j = await res.json().catch(() => ({}));
                  if (res.status === 401) {
                    const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
                    router.push(`/auth/sign-in?next=${encodeURIComponent(here)}`);
                    return;
                  }
                  const conv = j?.data || j?.conversation || null;
                  const id = conv?.id as string | undefined;
                  if (res.ok && id) {
                    setConversationId(id);
                    setChatOpen(true);
                  }
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "No se pudo iniciar el chat";
                  toast.error(msg);
                }
              }}
              disabled={me ? me === (p.professional_id as string) : false}
            >
              Enviar mensaje
            </Button>
            <label className="text-xs text-gray-600">Monto (MXN)</label>
            <input
              type="number"
              inputMode="numeric"
              className="w-28 rounded border px-2 py-1 text-xs"
              value={
                amountEdits[p.professional_id as string] ??
                (requestBudget != null ? String(requestBudget) : "")
              }
              onChange={(e) =>
                setAmountEdits((m) => ({
                  ...m,
                  [p.professional_id as string]: e.target.value,
                }))
              }
            />
            <Button
              size="sm"
              disabled={creating === (p.professional_id as string)}
              onClick={async () => {
                const proId = (p.professional_id as string) ?? "";
                if (!proId) return;
                setCreating(proId);
                try {
                  const raw =
                    amountEdits[proId] ??
                    (requestBudget != null ? String(requestBudget) : "");
                  const amount = Number(raw);
                  if (!Number.isFinite(amount) || amount <= 0)
                    return toast.error("Monto inválido");
                  const res = await fetch(`/api/agreements`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json; charset=utf-8",
                    },
                    body: JSON.stringify({
                      request_id: requestId,
                      professional_id: proId,
                      amount,
                    }),
                  });
                  const j = await res.json();
                  if (!res.ok)
                    throw new Error(
                      j?.detail || j?.error || "No se pudo crear el acuerdo",
                    );
                  toast.success("Acuerdo creado");
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("agreements:refresh", {
                        detail: requestId,
                      }),
                    );
                  }
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Error";
                  toast.error(msg);
                } finally {
                  setCreating(null);
                }
              }}
            >
              {creating === (p.professional_id as string)
                ? "Creando…"
                : "Crear acuerdo"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
    {chatOpen && conversationId ? (
      <ChatPanel
        conversationId={conversationId}
        userId={me}
        requestId={requestId}
        requestBudget={requestBudget}
        onClose={() => setChatOpen(false)}
      />
    ) : null}
    </>
  );
}
