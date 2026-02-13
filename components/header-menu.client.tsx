"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Menu, Settings as SettingsIcon } from "lucide-react";

import { createSupabaseBrowser } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/button";

function _MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function HeartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function MessageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

export default function HeaderMenu() {
  const [open, setOpen] = React.useState(false);
  const detailsRef = React.useRef<HTMLDetailsElement | null>(null);
  const [hasNotifs, setHasNotifs] = React.useState(false);
  const [hasNewMsgs, setHasNewMsgs] = React.useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = React.useState<number>(0);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const pathname = usePathname();
  type Notif = {
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    created_at: string | null;
    read_at: string | null;
  };
  const supabase = React.useMemo(() => createSupabaseBrowser(), []);
  const [me, setMe] = React.useState<string | null>(null);

  const [notifItems, setNotifItems] = React.useState<Notif[]>([]);
  const [notifLoading, setNotifLoading] = React.useState(false);

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
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json?.user?.id)
          setMe(json.user.id as string);
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

  React.useEffect(() => {
    try {
      const n =
        localStorage.getItem("handi_has_notifications") ??
        localStorage.getItem("handee_has_notifications");
      const m =
        localStorage.getItem("handi_has_new_messages") ??
        localStorage.getItem("handee_has_new_messages");
      setHasNotifs(n === "1" || n === "true");
      setHasNewMsgs(m === "1" || m === "true");
    } catch {
      // ignore
    }
  }, []);

  // Initial load from localStorage for message count
  React.useEffect(() => {
    try {
      const raw =
        localStorage.getItem("handi_unread_messages_count") ??
        localStorage.getItem("handee_unread_messages_count");
      const n = raw ? Number(raw) : 0;
      if (Number.isFinite(n)) {
        setUnreadMsgCount(n);
        setHasNewMsgs(n > 0);
      }
    } catch {
      // ignore
    }
  }, []);

  // Poll unread notifications count with backoff and visibility guard
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let aborted = false;
    let inflight = false;
    const isProd = process.env.NODE_ENV === "production";
    const baseInterval = isProd ? 180000 : 60000;
    const maxInterval = isProd ? 600000 : 180000;
    let nextInterval = baseInterval;

    const schedule = (delay: number) => {
      if (aborted) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    };

    async function run() {
      if (aborted) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        schedule(baseInterval);
        return;
      }
      if (!me) {
        schedule(baseInterval);
        return;
      }
      if (inflight) {
        schedule(nextInterval);
        return;
      }
      inflight = true;
      const start = Date.now();
      try {
        const headers = await buildAuthHeaders();
        const res = await fetch("/api/me/notifications/unread-count", {
          cache: "no-store",
          credentials: "include",
          headers,
        });
        if (!res.ok) throw new Error("bad_status");
        const json = (await res.json()) as { ok?: boolean; count?: number };
        const has = (json.count || 0) > 0;
        if (!aborted) {
          setHasNotifs(has);
        }
        try {
          localStorage.setItem("handi_has_notifications", has ? "1" : "0");
          // legacy key for transition period
          localStorage.setItem("handee_has_notifications", has ? "1" : "0");
        } catch {
          // ignore
        }
        const dur = Date.now() - start;
        nextInterval = dur > 2000 ? Math.min(maxInterval, nextInterval * 2) : baseInterval;
      } catch {
        nextInterval = Math.min(maxInterval, nextInterval * 2);
      } finally {
        inflight = false;
        schedule(nextInterval);
      }
    }

    run();
    const onVis = () => {
      if (document.visibilityState === "visible") schedule(1000);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      aborted = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [buildAuthHeaders, me]);

  // Poll unread messages count with backoff and visibility guard
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let aborted = false;
    let inflight = false;
    const isProd = process.env.NODE_ENV === "production";
    const baseInterval = isProd ? 180000 : 60000;
    const maxInterval = isProd ? 600000 : 180000;
    let nextInterval = baseInterval;

    const schedule = (delay: number) => {
      if (aborted) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    };

    async function run() {
      if (aborted) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        schedule(baseInterval);
        return;
      }
      if (!me) {
        schedule(baseInterval);
        return;
      }
      if (inflight) {
        schedule(nextInterval);
        return;
      }
      inflight = true;
      const start = Date.now();
      try {
        const headers = await buildAuthHeaders();
        const res = await fetch("/api/chat/rooms", {
          cache: "no-store",
          credentials: "include",
          headers,
        });
        if (!res.ok) throw new Error("bad_status");
        const json = (await res.json()) as {
          ok?: boolean;
          data?: Array<{ unreadCount?: number }>;
        };
        const arr = Array.isArray(json?.data) ? json.data : [];
        const count = arr.reduce(
          (acc, it) =>
            acc + (typeof it.unreadCount === "number" ? it.unreadCount : 0),
          0,
        );
        if (!aborted) {
          setUnreadMsgCount(count);
          setHasNewMsgs(count > 0);
        }
        try {
          localStorage.setItem("handi_unread_messages_count", String(count));
          localStorage.setItem("handee_unread_messages_count", String(count));
          localStorage.setItem("handi_has_new_messages", count > 0 ? "1" : "0");
          localStorage.setItem(
            "handee_has_new_messages",
            count > 0 ? "1" : "0",
          );
        } catch {
          // ignore
        }
        const dur = Date.now() - start;
        nextInterval = dur > 2000 ? Math.min(maxInterval, nextInterval * 2) : baseInterval;
      } catch {
        nextInterval = Math.min(maxInterval, nextInterval * 2);
      } finally {
        inflight = false;
        schedule(nextInterval);
      }
    }

    run();
    const onVis = () => {
      if (document.visibilityState === "visible") schedule(1000);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      aborted = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [buildAuthHeaders, me]);

  // Refresh counts when tab gains focus
  React.useEffect(() => {
    const onFocus = () => {
      try {
        const raw = localStorage.getItem("handi_unread_messages_count");
        const n = raw ? Number(raw) : 0;
        if (Number.isFinite(n)) {
          setUnreadMsgCount(n);
          setHasNewMsgs(n > 0);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const loadNotifications = React.useCallback(async () => {
    setNotifLoading(true);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch("/api/me/notifications?limit=10", {
        cache: "no-store",
        credentials: "include",
        headers,
      });
      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; items?: Notif[] };
        const list = (json.items || []) as Notif[];
        setNotifItems(list);
        setHasNotifs(list.some((x) => !x.read_at));
      }
    } catch {
      setNotifItems([]);
    } finally {
      setNotifLoading(false);
    }
  }, [buildAuthHeaders]);

  React.useEffect(() => {
    if (open && notifOpen) {
      void loadNotifications();
    }
  }, [open, notifOpen, loadNotifications]);

  async function onMarkAllRead() {
    try {
      const headers = await buildAuthHeaders();
      await fetch("/api/me/notifications/mark-read", {
        method: "POST",
        credentials: "include",
        headers,
      });
      setNotifItems((prev) =>
        prev.map((x) => ({ ...x, read_at: new Date().toISOString() })),
      );
      setHasNotifs(false);
      try {
        localStorage.setItem("handi_has_notifications", "0");
        localStorage.setItem("handee_has_notifications", "0");
      } catch {
        /* ignore */
      }
    } catch {
      // ignore
    }
  }

  // Close when clicking outside or pressing Escape
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (
        detailsRef.current &&
        !detailsRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const text = "Únete a Handi y conecta con expertos de confianza";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Handi", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado al portapapeles");
      }
    } catch {
      // ignored
    }
  }

  // Close menu utility (used when clicking any item)
  const closeMenu = React.useCallback(() => {
    setOpen(false);
    try {
      if (detailsRef.current) detailsRef.current.open = false;
    } catch {
      /* ignore */
    }
  }, []);

  // Close menu on route change as a safety net
  React.useEffect(() => {
    if (open) closeMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <details
      ref={detailsRef}
      className="relative"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className={buttonVariants({
          variant: "ghost",
          size: "icon",
          className:
            "list-none cursor-pointer relative flex h-10 w-10 items-center justify-center rounded-full bg-black/20 px-3 py-2 text-white shadow-sm backdrop-blur transition hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70",
        })}
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
        {(hasNotifs || hasNewMsgs) && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </summary>
      <div className="absolute right-0 mt-2 w-60 rounded-xl bg-black/30 text-white shadow-lg backdrop-blur-xl p-1 z-50">
        {/* Notificaciones */}
        <button
          type="button"
          onClick={async () => {
            setNotifOpen((v) => !v);
            // Clear notif badge immediately
            setHasNotifs(false);
            try {
              localStorage.setItem("handi_has_notifications", "0");
              localStorage.setItem("handee_has_notifications", "0");
            } catch {
              /* ignore */
            }
            // Best-effort: mark all as read in background
            try {
              const headers = await buildAuthHeaders();
              await fetch("/api/me/notifications/mark-read", {
                method: "POST",
                credentials: "include",
                headers,
              });
            } catch {
              /* ignore */
            }
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-white hover:bg-white/10 relative"
        >
          <BellIcon />
          <span>Notificaciones</span>
          {hasNotifs && (
            <span className="ml-auto h-2.5 w-2.5 rounded-full bg-red-500" />
          )}
        </button>
        {notifOpen ? (
          <div className="mb-1 rounded border bg-white p-1">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-xs text-slate-600">
                Pendientes y recientes
              </span>
              <button
                className="text-xs text-blue-600 hover:underline"
                onClick={onMarkAllRead}
              >
                Marcar leídas
              </button>
            </div>
            {notifLoading ? (
              <div className="px-2 py-1 text-xs text-slate-500">Cargando…</div>
            ) : notifItems.length === 0 ? (
              <div className="px-2 py-1 text-xs text-slate-500">
                Sin notificaciones
              </div>
            ) : (
              <ul className="max-h-64 overflow-auto">
                {notifItems.map((n) => (
                  <li
                    key={n.id}
                    className={`rounded px-2 py-1 text-xs hover:bg-neutral-50 ${!n.read_at ? "bg-orange-50" : ""}`}
                  >
                    <div className="font-medium text-slate-900">{n.title}</div>
                    {n.body ? (
                      <div className="text-slate-600">{n.body}</div>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {n.created_at
                          ? new Date(n.created_at).toLocaleString()
                          : ""}
                      </span>
                      {n.link ? (
                        <Link
                          href={n.link}
                          className="text-blue-600 hover:underline"
                          onClick={closeMenu}
                        >
                          Abrir
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {/* Cambiar tipo de usuario: movido solo al dropdown del avatar */}
        <Link
          href="/favorites"
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-white hover:bg-white/10"
          onClick={closeMenu}
        >
          <HeartIcon />
          <span>Favoritos</span>
        </Link>
        <Link
          href="/messages"
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-white hover:bg-white/10 relative"
          data-testid="open-messages-link"
          onClick={() => {
            // Clear messages badge immediately
            setUnreadMsgCount(0);
            setHasNewMsgs(false);
            try {
              localStorage.setItem("handi_unread_messages_count", "0");
              localStorage.setItem("handee_unread_messages_count", "0");
              localStorage.setItem("handi_has_new_messages", "0");
              localStorage.setItem("handee_has_new_messages", "0");
            } catch {
              /* ignore */
            }
            closeMenu();
          }}
        >
          <span className="relative inline-flex items-center justify-center">
            <MessageIcon />
            {unreadMsgCount > 0 ? (
              <span
                aria-label={`${unreadMsgCount} mensajes sin leer`}
                className="absolute -top-1 -right-2 min-w-[1rem] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center"
              >
                {unreadMsgCount > 99 ? "99+" : unreadMsgCount}
              </span>
            ) : null}
          </span>
          <span>Mensajes</span>
        </Link>
        <div className="my-1 h-px bg-white/20" />
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-white hover:bg-white/10"
          onClick={closeMenu}
        >
          <SettingsIcon className="h-4 w-4" />
          <span>Configuración</span>
        </Link>
        <div className="my-1 h-px bg-white/20" />
        <button
          type="button"
          onClick={() => {
            void onShare();
            closeMenu();
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-white hover:bg-white/10"
        >
          <ShareIcon />
          <span>Invita a un amigo</span>
        </button>
      </div>
    </details>
  );
}
