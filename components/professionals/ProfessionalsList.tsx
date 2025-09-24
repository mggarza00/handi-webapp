/* eslint-disable import/order */
"use client";
import * as React from "react";
// import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import RatingStars from "@/components/ui/RatingStars";
import { toast } from "sonner";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Professional = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  rating?: number | null;
};

export type ProfessionalsListProps = {
  requestId: string;
  category?: string | null;
  subcategory?: string | null;
  city?: string | null;
  className?: string;
};

export default function ProfessionalsList({
  requestId,
  category,
  subcategory,
  city,
  className,
}: ProfessionalsListProps) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Professional[]>([]);
  // redirección a /mensajes/{id} reemplaza el panel embebido
  const [startingFor, setStartingFor] = React.useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [meId, setMeId] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  // Lazy-load ChatPanel only when needed to avoid pulling its chunk during initial hydration
  // const ChatPanel = React.useMemo(() => dynamic<ChatPanelProps>(() => import("@/components/chat/ChatPanel").then((m) => m.default), { ssr: false, loading: () => null }), []);

  // NOTE: Evitar doble resolución del user id desde el cliente para no interferir con la hidratación.
  // Usamos únicamente /api/me, que ya contempla fallback dev con Authorization: Bearer.

  React.useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(`/api/me`, {
          cache: "no-store",
          credentials: "include",
          signal: ac.signal,
        });
        const j = await r.json().catch(() => ({}));
        if (!ac.signal.aborted && r.ok && j?.user?.id) setMeId(j.user.id as string);
      } catch {
        // ignore AbortError or network issues silently
      }
    })();
    return () => ac.abort();
  }, []);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    let abort = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (category) qs.set("category", category);
        if (subcategory) qs.set("subcategory", subcategory);
        if (city) qs.set("city", city);
        const url = `/api/professionals${qs.toString() ? `?${qs.toString()}` : ""}`;
        const res = await fetch(url, {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          // Si no está autenticado, mostrar vacío en lugar de error ruidoso
          if (res.status === 401) {
            if (!abort) setItems([]);
            return;
          }
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const j = (await res.json()) as { ok?: boolean; data?: unknown };
        const data = (Array.isArray(j?.data) ? j?.data : []) as unknown[];
        const mapped: Professional[] = data
          .map((x) => x as Record<string, unknown>)
          .map((r) => ({
            id: String(r.id ?? ""),
            full_name: (r.full_name as string | null) ?? null,
            avatar_url: (r.avatar_url as string | null) ?? null,
            headline: (r.headline as string | null) ?? null,
            bio: (r.bio as string | null) ?? null,
            rating: typeof r.rating === "number" ? (r.rating as number) : null,
          }))
          .filter((p) => p.id);
        if (!abort) setItems(mapped);
      } catch (e) {
        if (!abort) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!abort) setLoading(false);
      }
    }
    run();
    return () => {
      abort = true;
    };
  }, [category, subcategory, city]);

  if (!mounted) return <div className={className}>Cargando…</div>;
  if (loading) return <div className={className}>Cargando profesionales…</div>;
  if (error)
    return (
      <div className={className}>
        No se encuentran profesionales disponibles para esta solicitud.
      </div>
    );
  if (items.length === 0)
    return (
      <div className={className}>
        No se encuentran profesionales disponibles para esta solicitud.
      </div>
    );

  return (
    <div className={"space-y-3 " + (className ?? "")}> 
      {items.map((p) => (
        <Card
          key={p.id}
          className="p-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50/60"
          onClick={(event) => {
            if (event.defaultPrevented) return;
            router.push(`/profiles/${p.id}`);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.defaultPrevented) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push(`/profiles/${p.id}`);
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.avatar_url || "/avatar.png"}
            alt={p.full_name || "Avatar"}
            className="size-12 rounded-full object-cover border"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {p.full_name ?? "Profesional"}
                </div>
                <div className="text-xs text-slate-600 truncate">
                  {p.headline ?? ""}
                </div>
              </div>
              {typeof p.rating === "number" && <RatingStars value={p.rating} />}
            </div>
            {p.bio ? (
              <p className="mt-1 text-xs text-slate-700 line-clamp-2">
                {p.bio}
              </p>
            ) : null}
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                data-testid="open-request-chat"
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  try {
                    setStartingFor(p.id);
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
                        ...(meId ? { "x-user-id": meId } : {}),
                      },
                      credentials: "include",
                      body: JSON.stringify({ requestId, proId: p.id }),
                    });
                    const j = await res.json().catch(() => ({}));
                    if (res.status === 401) {
                      const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
                      router.push(`/auth/sign-in?next=${encodeURIComponent(here)}`);
                      return;
                    }
                    if (!res.ok) throw new Error(j?.error || "start_failed");
                    const convId: string | undefined = j?.data?.id ?? j?.conversation?.id;
                    if (convId) router.push(`/mensajes/${convId}`);
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : "No se pudo iniciar el chat";
                    toast.error(msg);
                  } finally {
                    setStartingFor(null);
                  }
                }}
                disabled={startingFor === p.id}
              >
                {startingFor === p.id ? "Abriendo…" : "Enviar mensaje"}
              </Button>
            </div>
          </div>
        </Card>
      ))}
      {/* Redirección a /mensajes/{id} sustituye el panel embebido */}
    </div>
  );
}
