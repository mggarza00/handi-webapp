"use client";
import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function NotificationsDropdown() {
  const [open, setOpen] = React.useState(false);
  const supabase = React.useMemo(() => createSupabaseBrowser(), []);
  const [me, setMe] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Array<{
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    created_at: string | null;
    read_at: string | null;
  }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasUnread, setHasUnread] = React.useState(false);

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
        const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json?.user?.id) setMe(json.user.id as string);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const buildAuthHeaders = React.useCallback(async () => {
    const headers: Record<string, string> = {};
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
        headers["x-access-token"] = session.access_token;
      }
    } catch {
      /* ignore */
    }
    if (me) headers["x-user-id"] = me;
    return headers;
  }, [supabase, me]);

  type Notif = { id: string; title: string; body: string | null; link: string | null; created_at: string | null; read_at: string | null };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch("/api/me/notifications?limit=20", {
        cache: "no-store",
        credentials: "include",
        headers,
      });
      if (!res.ok) {
        setItems([]);
        setHasUnread(false);
        return;
      }
  const json = (await res.json()) as { ok?: boolean; items?: Notif[] };
  const list = (json.items || []) as Notif[];
      setItems(list);
      setHasUnread(list.some((x) => !x.read_at));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [buildAuthHeaders]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const markAllRead = React.useCallback(async () => {
    try {
      const headers = await buildAuthHeaders();
      await fetch("/api/me/notifications/mark-read", {
        method: "POST",
        credentials: "include",
        headers,
      });
      setItems((prev) => prev.map((x) => ({ ...x, read_at: new Date().toISOString() })));
      setHasUnread(false);
      try { localStorage.setItem("handee_has_notifications", "0"); } catch { /* ignore */ }
    } catch {
      // ignore mark read failures in UI
    }
  }, [buildAuthHeaders]);

  return (
    <details className="relative" open={open} onToggle={(e) => {
      const o = (e.target as HTMLDetailsElement).open;
      setOpen(o);
      if (o) load();
    }}>
      <summary className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-white hover:bg-neutral-100 cursor-pointer relative" aria-label="Notificaciones">
        <Bell className="h-5 w-5" />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </summary>
      <div className="absolute right-0 mt-2 w-80 rounded-md border bg-white shadow-md p-2 z-50">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Notificaciones</div>
          <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">Marcar como leídas</button>
        </div>
        {loading ? (
          <div className="p-2 text-sm text-slate-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-2 text-sm text-slate-500">No hay notificaciones</div>
        ) : (
          <ul className="max-h-80 overflow-auto">
            {items.map((n) => (
              <li key={n.id} className={`rounded px-2 py-1.5 text-sm hover:bg-neutral-50 ${!n.read_at ? "bg-orange-50" : ""}`}>
                <div className="font-medium">{n.title}</div>
                {n.body ? <div className="text-slate-600">{n.body}</div> : null}
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
                  {n.link ? (
                    <Link href={n.link} className="text-blue-600 hover:underline">Abrir</Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
