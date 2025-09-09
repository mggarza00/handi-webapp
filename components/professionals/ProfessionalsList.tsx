/* eslint-disable import/order */
"use client";
import * as React from "react";
// import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import RatingStars from "@/components/ui/RatingStars";
import ChatPanel from "@/components/chat/ChatPanel";
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
  const [openConvId, setOpenConvId] = React.useState<string | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [startingFor, setStartingFor] = React.useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [meId, setMeId] = React.useState<string | null>(null);

  // Obtener el id de usuario desde el cliente de Supabase (no depende de /api/me)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled && data?.user?.id) setMeId(data.user.id);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/me`, { cache: "no-store", credentials: "include" });
        const j = await r.json().catch(() => ({}));
        if (!cancelled && r.ok && j?.user?.id) setMeId(j.user.id as string);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
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
          onClick={() => router.push(`/profiles/${p.id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
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
                onClick={async () => {
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
                    if (convId) {
                      setOpenConvId(convId);
                      setChatOpen(true);
                    }
                  } catch {
                    // opcional: toast de error
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
      {chatOpen && openConvId ? (
        <ChatPanel
          conversationId={openConvId}
          userId={meId}
          onClose={() => {
            setChatOpen(false);
            setOpenConvId(null);
          }}
        />
      ) : null}
    </div>
  );
}
