"use client";

import * as React from "react";
import { Menu, Bell, MessageSquare, Heart, Settings, HelpCircle, FileText, Share2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";

export interface NavLink {
  href: string;
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "lg" | "default";
}

// Por solicitud, se elimina el set de enlaces por defecto
// para no mostrar en el menú móvil: "Solicitudes", "Publicar solicitud",
// "Panel Pro", "Panel Cliente" y "Perfil".
const DEFAULT_LINKS: NavLink[] = [];

type Role = "client" | "pro" | "admin" | null;

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string | null;
  read_at: string | null;
};

function MenuLinks({ items, className }: { items: NavLink[]; className?: string }) {
  const { setOpen } = useSidebar();
  const containerClass = ["flex flex-col gap-2", className].filter(Boolean).join(" ");
  const getIcon = (l: NavLink): string | null => {
    if (l.label === "Mis solicitudes" || l.href === "/requests?mine=1") return "/images/icono-mis-solicitudes.gif";
    if (l.label === "Nueva solicitud" || l.href === "/requests/new") return "/images/icono-nueva-solicitud.gif";
    if (l.label === "Trabajos disponibles" || l.href === "/requests/explore") return "/images/icono-trabajos-disponibles.gif";
    if (l.label === "Trabajos realizados" || l.href === "/applied") return "/images/icono-trabajos-realizados.gif";
    return null;
  };
  return (
    <nav className={containerClass}>
      {items.map((l) => (
        <Button
          key={l.href}
          asChild
          variant={l.variant ?? "ghost"}
          size={l.size ?? "default"}
          className="w-full justify-start text-base"
          onClick={() => setOpen(false)}
        >
          <Link href={l.href} className="inline-flex items-center gap-2">
            {getIcon(l) ? (
              <Image src={getIcon(l)!} alt="" width={32} height={32} className="h-8 w-8" />
            ) : null}
            <span>{l.label}</span>
          </Link>
        </Button>
      ))}
    </nav>
  );
}

function OpenButton({ hasBadge }: { hasBadge?: boolean }) {
  const { setOpen } = useSidebar();
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Abrir menú"
      onClick={() => setOpen(true)}
      className="relative"
    >
      <Menu className="h-5 w-5" />
      {hasBadge ? (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
      ) : null}
    </Button>
  );
}

type MobileMenuProps = {
  links?: NavLink[];
  isAuth?: boolean;
  role?: Role;
  avatarUrl?: string | null;
  fullName?: string | null;
  isClientPro?: boolean;
};

function MobileMenuDrawer({
  items,
  isAuth,
  role,
  avatarUrl,
  fullName,
  isClientPro,
}: {
  items: NavLink[];
  isAuth: boolean;
  role: Role;
  avatarUrl: string | null;
  fullName: string | null;
  isClientPro?: boolean;
}) {
  const { open, setOpen } = useSidebar();
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [hasNotifs, setHasNotifs] = React.useState(false);
  const [hasNewMsgs, setHasNewMsgs] = React.useState(false);
  const [notifItems, setNotifItems] = React.useState<Notif[]>([]);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const supabase = React.useMemo(() => createSupabaseBrowser(), []);
  const [me, setMe] = React.useState<string | null>(null);
  const [unreadMsgCount, setUnreadMsgCount] = React.useState<number>(0);

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
        if (!cancelled && res.ok && json?.user?.id) {
          setMe(json.user.id as string);
        }
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
      const raw =
        localStorage.getItem("handi_unread_messages_count") ??
        localStorage.getItem("handee_unread_messages_count");
      setHasNotifs(n === "1" || n === "true");
      setHasNewMsgs(m === "1" || m === "true");
      const ncount = raw ? Number(raw) : 0;
      if (Number.isFinite(ncount)) setUnreadMsgCount(ncount);
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (!isAuth) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let aborted = false;
    async function fetchCount() {
      try {
        const headers = await buildAuthHeaders();
        const res = await fetch("/api/me/notifications/unread-count", {
          cache: "no-store",
          credentials: "include",
          headers,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { ok?: boolean; count?: number };
        const has = (json.count || 0) > 0;
        if (!aborted) {
          setHasNotifs(has);
        }
        try {
          localStorage.setItem("handi_has_notifications", has ? "1" : "0");
          localStorage.setItem("handee_has_notifications", has ? "1" : "0");
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    }
    void fetchCount();
    timer = setInterval(fetchCount, 60000);
    return () => {
      aborted = true;
      if (timer) clearInterval(timer);
    };
  }, [isAuth, buildAuthHeaders]);

  // Poll unread messages count periodically
  React.useEffect(() => {
    if (!isAuth) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let aborted = false;
    async function fetchMsgCount() {
      try {
        const headers = await buildAuthHeaders();
        const res = await fetch("/api/chat/rooms", {
          cache: "no-store",
          credentials: "include",
          headers,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { ok?: boolean; data?: Array<{ unreadCount?: number }> };
        const arr = Array.isArray(json?.data) ? json.data : [];
        const count = arr.reduce((acc, it) => acc + (typeof it.unreadCount === 'number' ? it.unreadCount : 0), 0);
        if (!aborted) {
          setUnreadMsgCount(count);
          setHasNewMsgs(count > 0);
        }
        try {
          localStorage.setItem("handi_unread_messages_count", String(count));
          localStorage.setItem("handee_unread_messages_count", String(count));
          localStorage.setItem("handi_has_new_messages", count > 0 ? "1" : "0");
          localStorage.setItem("handee_has_new_messages", count > 0 ? "1" : "0");
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    }
    void fetchMsgCount();
    timer = setInterval(fetchMsgCount, 60000);
    return () => {
      aborted = true;
      if (timer) clearInterval(timer);
    };
  }, [isAuth, buildAuthHeaders]);

  const loadNotifications = React.useCallback(async () => {
    if (!isAuth) return;
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
  }, [isAuth, buildAuthHeaders]);

  React.useEffect(() => {
    if (open && notifOpen) {
      void loadNotifications();
    }
  }, [open, notifOpen, loadNotifications]);

  React.useEffect(() => {
    if (!open) setNotifOpen(false);
  }, [open]);

  const onMarkAllRead = React.useCallback(async () => {
    if (!isAuth) return;
    try {
      const headers = await buildAuthHeaders();
      await fetch("/api/me/notifications/mark-read", {
        method: "POST",
        credentials: "include",
        headers,
      });
      setNotifItems((prev) => prev.map((x) => ({ ...x, read_at: new Date().toISOString() })));
      setHasNotifs(false);
      try {
        localStorage.setItem("handi_has_notifications", "0");
        localStorage.setItem("handee_has_notifications", "0");
      } catch {
        // ignore
      }
    } catch {
      // ignore failures silently
    }
  }, [isAuth, buildAuthHeaders]);

  const onShare = React.useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const text = "Asnete a Handi y conecta con expertos de confianza";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Handi", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado al portapapeles");
      }
    } catch {
      // ignore share errors
    }
  }, []);

  const initials = (fullName?.trim()?.split(/\s+/)?.map((p) => p[0])?.slice(0, 2)?.join("") || "U").toUpperCase();

  const requestsLink = items.find((l) => l.href.startsWith("/requests"));
  const otherLinks = items.filter((l) => !l.href.startsWith("/requests"));
  const navLinks = role === "client" && requestsLink ? otherLinks : items;
  const getIcon = (l: NavLink): string | null => {
    if (l.label === "Mis solicitudes" || l.href === "/requests?mine=1") return "/images/icono-mis-solicitudes.gif";
    if (l.label === "Nueva solicitud" || l.href === "/requests/new") return "/images/icono-nueva-solicitud.gif";
    if (l.label === "Trabajos disponibles" || l.href === "/requests/explore") return "/images/icono-trabajos-disponibles.gif";
    if (l.label === "Trabajos realizados" || l.href === "/applied") return "/images/icono-trabajos-realizados.gif";
    return null;
  };

  return (
    <>
      <OpenButton />
      <Sidebar side="left" width={320}>
        <SidebarHeader className="text-xl font-semibold">Handi</SidebarHeader>
        <SidebarContent className="mt-4 gap-4">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-base"
              onClick={() => {
                setNotifOpen((v) => !v);
                // Clear notif badge immediately
                setHasNotifs(false);
                try {
                  localStorage.setItem("handi_has_notifications", "0");
                  localStorage.setItem("handee_has_notifications", "0");
                } catch { /* ignore */ }
                // Best-effort: mark all as read in background
                void onMarkAllRead();
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Bell className="h-8 w-8" />
                <span>Notificaciones</span>
                {hasNotifs ? <span className="ml-2 h-2.5 w-2.5 rounded-full bg-red-500" /> : null}
              </span>
            </Button>
            {notifOpen ? (
              <div className="rounded-md border bg-white p-2 text-sm shadow-sm">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs text-slate-600">Pendientes y recientes</span>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={onMarkAllRead}
                  >
                    Marcar leídas
                  </button>
                </div>
                {notifLoading ? (
                  <div className="px-2 py-1 text-xs text-slate-500">Cargando…</div>
                ) : notifItems.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-slate-500">Sin notificaciones</div>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-auto">
                    {notifItems.map((n) => (
                      <li
                        key={n.id}
                        className={`rounded px-2 py-1 text-xs hover:bg-neutral-50 ${!n.read_at ? "bg-orange-50" : ""}`}
                      >
                        <div className="font-medium text-slate-900">{n.title}</div>
                        {n.body ? <div className="text-slate-600">{n.body}</div> : null}
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</span>
                          {n.link ? (
                            <Link
                              href={n.link}
                              className="text-blue-600 hover:underline"
                              onClick={() => setOpen(false)}
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
            <Button asChild variant="ghost" className="w-full justify-start text-base" onClick={() => {
              // Clear messages badge immediately
              setUnreadMsgCount(0);
              setHasNewMsgs(false);
              try {
                localStorage.setItem("handi_unread_messages_count", "0");
                localStorage.setItem("handee_unread_messages_count", "0");
                localStorage.setItem("handi_has_new_messages", "0");
                localStorage.setItem("handee_has_new_messages", "0");
              } catch { /* ignore */ }
              setOpen(false);
            }}>
              <Link href="/favorites" className="inline-flex items-center gap-2">
                <Heart className="h-8 w-8" />
                <span>Favoritos</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start text-base" onClick={() => setOpen(false)}>
              <Link href="/messages" className="inline-flex items-center gap-2">
                <span className="relative inline-flex items-center justify-center">
                  <MessageSquare className="h-8 w-8" />
                  {unreadMsgCount > 0 ? (
                    <span
                      aria-label={`${unreadMsgCount} mensajes sin leer`}
                      className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center"
                    >
                      {unreadMsgCount > 99 ? "99+" : unreadMsgCount}
                    </span>
                  ) : null}
                </span>
                <span>Mensajes</span>
              </Link>
            </Button>
          </div>

          {role === "client" && requestsLink ? (
            <Button
              asChild
              size={requestsLink.size ?? "default"}
              variant={requestsLink.variant ?? "ghost"}
              className="w-full justify-start text-base"
              onClick={() => setOpen(false)}
            >
              <Link href={requestsLink.href} className="inline-flex items-center gap-2">
                {getIcon(requestsLink) ? (
                  <Image src={getIcon(requestsLink)!} alt="" width={32} height={32} className="h-8 w-8" />
                ) : null}
                <span>{requestsLink.label}</span>
              </Link>
            </Button>
          ) : null}

          {navLinks.length > 0 ? (
            <MenuLinks items={navLinks} className="pt-2" />
          ) : null}
        </SidebarContent>
        <SidebarFooter>
          {isAuth ? (
            <Button
              asChild
              variant="ghost"
              className="w-full justify-start text-base"
              onClick={() => setOpen(false)}
            >
              <Link href="/settings" className="inline-flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <span>Configuración</span>
              </Link>
            </Button>
          ) : null}
          <Button
            asChild
            variant="ghost"
            className="w-full justify-start text-base"
            onClick={() => setOpen(false)}
          >
            <Link href="/help" className="inline-flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              <span>Centro de ayuda</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="w-full justify-start text-base"
            onClick={() => setOpen(false)}
          >
            <Link href="/privacy" className="inline-flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <span>Aviso de privacidad</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-base"
            onClick={() => {
              void onShare();
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              <span>Invita a un amigo</span>
            </span>
          </Button>
          {isAuth ? (
            <details className="mt-1">
              <summary className="list-none flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-100 cursor-pointer">
                <Avatar className="h-8 w-8">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName ?? "Usuario"} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{fullName ?? "Cuenta"}</span>
              </summary>
              <div className="mt-2 rounded-md border bg-white shadow-md p-1">
                <div className="px-2 py-1.5 text-sm font-semibold">{fullName ?? "Cuenta"}</div>
                <div className="my-1 h-px bg-neutral-200" />
                <Link
                  href="/me"
                  onClick={() => setOpen(false)}
                  className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100"
                >
                  Mi perfil
                </Link>
                <Link
                  href="/profile/setup"
                  onClick={() => setOpen(false)}
                  className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100"
                >
                  {role === "pro" || isClientPro ? "Configura tu perfil de profesional" : "Configura tu perfil"}
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100"
                >
                  Configuración
                </Link>
                <div className="my-1 h-px bg-neutral-200" />
                <form action="/auth/sign-out" method="post">
                  <button
                    type="submit"
                    className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100"
                  >
                    Salir
                  </button>
                </form>
              </div>
            </details>
          ) : null}
        </SidebarFooter>
      </Sidebar>
    </>
  );
}

export default function MobileMenu({
  links,
  isAuth = false,
  role = null,
  avatarUrl = null,
  fullName = null,
  isClientPro = false,
}: MobileMenuProps) {
  const items = links && links.length > 0 ? links : DEFAULT_LINKS;

  return (
    <div className="md:hidden">
      <SidebarProvider>
        <MobileMenuDrawer items={items} isAuth={isAuth} role={role} avatarUrl={avatarUrl} fullName={fullName} isClientPro={isClientPro} />
      </SidebarProvider>
    </div>
  );
}
