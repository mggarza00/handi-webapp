"use client";
import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function NotificationsDropdown() {
  const [open, setOpen] = React.useState(false);
  const detailsRef = React.useRef<HTMLDetailsElement | null>(null);
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
      setItems((prev) => {
        const next = prev.map((x) => ({ ...x, read_at: new Date().toISOString() }));
        setHasUnread(false);
        try { localStorage.setItem("handee_has_notifications", "0"); } catch { /* ignore */ }
        return next;
      });
    } catch {
      // ignore mark read failures in UI
    }
  }, [buildAuthHeaders]);

  // When opening a single notification, mark it read locally and update badge state
  const onOpenItem = React.useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, read_at: new Date().toISOString() } : x));
      const anyUnread = next.some((x) => !x.read_at);
      setHasUnread(anyUnread);
      return next;
    });
    setOpen(false);
  }, []);

  // Close on outside click while open
  React.useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const el = detailsRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <details ref={detailsRef} className="relative" open={open} onToggle={(e) => {
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
            {items.map((n) => {
              const unread = !n.read_at;
              return (
              <li key={n.id}>
                {n.link ? (
                  <Link
                    href={n.link}
                    className={`block rounded px-2 py-1.5 text-sm hover:bg-neutral-50 ${unread ? "bg-orange-50" : ""}`}
                    onClick={() => onOpenItem(n.id)}
                  >
                    <div className="font-medium flex items-center">
                      <span>{n.title}</span>
                      {unread ? (
                        <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" aria-label="Sin leer" />
                      ) : null}
                    </div>
                    {n.body ? <div className="text-slate-600">{n.body}</div> : null}
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
                    </div>
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={`w-full text-left rounded px-2 py-1.5 text-sm hover:bg-neutral-50 ${unread ? "bg-orange-50" : ""}`}
                    onClick={() => onOpenItem(n.id)}
                  >
                    <div className="font-medium flex items-center">
                      <span>{n.title}</span>
                      {unread ? (
                        <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" aria-label="Sin leer" />
                      ) : null}
                    </div>
                    {n.body ? <div className="text-slate-600">{n.body}</div> : null}
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
                    </div>
                  </button>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
