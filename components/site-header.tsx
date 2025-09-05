import Image from "next/image";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import MobileMenu from "@/components/mobile-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Database } from "@/types/supabase";

type Role = "client" | "pro" | "admin";

export const dynamic = "force-dynamic";

async function getSessionInfo() {
  noStore();
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { isAuth: false as const, role: null as null, avatar_url: null as null, full_name: null as null };

  let { data: profileRaw } = await supabase
    .from("profiles")
    .select("role, avatar_url, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileRaw) {
    // Autoaprovisionar perfil mínimo en primer login
    try {
      await supabase
        .from("profiles")
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
          last_active_at: new Date().toISOString(),
          active: true,
        } satisfies Database["public"]["Tables"]["profiles"]["Insert"]);
    } catch (err) {
      void err; // ignore insert errors (profile may already exist)
    }
    const retry = await supabase
      .from("profiles")
      .select("role, avatar_url, full_name")
      .eq("id", user.id)
      .maybeSingle();
    profileRaw = retry.data ?? null;
  }
  const profile = (profileRaw ?? null) as (null | { role: Role | null; avatar_url: string | null; full_name: string | null });
  const role = (profile?.role ?? null) as Role | null;
  type UserMeta = { avatar_url?: string | null; full_name?: string | null };
  const meta = (user.user_metadata as unknown as UserMeta) || {};
  const avatarUrl = profile?.avatar_url ?? meta.avatar_url ?? null;
  const fullName = profile?.full_name ?? meta.full_name ?? null;
  return {
    isAuth: true as const,
    role,
    avatar_url: avatarUrl,
    full_name: fullName,
  };
}

async function getSessionInfoSafe() {
  try {
    const hasEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return { isAuth: false as const, role: null as null, avatar_url: null as null, full_name: null as null };
    }
    return await getSessionInfo();
  } catch {
    return { isAuth: false as const, role: null as null, avatar_url: null as null, full_name: null as null };
  }
}

export default async function SiteHeader() {
  const { isAuth, role, avatar_url, full_name } = await getSessionInfoSafe();

  // El logo siempre debe redirigir a la página de inicio
  const leftHref = "/";

  const rightLinks: {
    href: string;
    label: string;
    variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
    size?: "sm" | "lg" | "default";
  }[] = [];
  // Eliminado botón "Biblioteca" del header/menú
  if (!isAuth) {
    rightLinks.push({ href: "/auth/sign-in", label: "Iniciar sesión", variant: "ghost", size: "sm" });
    rightLinks.push({ href: "/profile/setup", label: "Postúlate como profesional", variant: "default", size: "lg" });
  } else if (role === "client") {
    rightLinks.push(
      { href: "/requests?mine=1", label: "Mis solicitudes", variant: "ghost", size: "sm" },
    );
  } else if (role === "pro") {
    rightLinks.push(
      { href: "/requests/explore", label: "Ver solicitudes", variant: "default", size: "lg" },
      { href: "/applied", label: "Mis postulaciones", variant: "ghost", size: "sm" },
      { href: "/pro/profile", label: "Mi perfil profesional", variant: "ghost", size: "sm" },
    );
  } else if (role === "admin") {
    rightLinks.push(
      { href: "/admin", label: "Panel", variant: "default", size: "lg" },
      { href: "/admin/users", label: "Usuarios", variant: "ghost", size: "sm" },
      { href: "/admin/requests", label: "Solicitudes", variant: "ghost", size: "sm" },
      { href: "/admin/professionals", label: "Profesionales", variant: "ghost", size: "sm" },
    );
  }

  // Asegurar que "Mis solicitudes" esté visible solo para clientes (o rol aún no asignado) y administradores
  if (isAuth && (role === "client" || role == null || role === "admin")) {
    const hasRequestsLink = rightLinks.some((l) => l.href.startsWith("/requests"));
    if (!hasRequestsLink) {
      const href = role === "admin" ? "/requests" : "/requests?mine=1";
      rightLinks.push({ href, label: "Mis solicitudes", variant: "ghost", size: "sm" });
    }
  }

  // Enlaces para el menú móvil (excluye iniciar sesión; apariencia idéntica al header)
  const mobileLinks = (() => {
    const base = rightLinks.filter((x) => x.href !== "/auth/sign-in");
    return base;
  })();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-white/50 dark:bg-neutral-900/50 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        {/* Lado izquierdo: botón menú móvil */}
        <div className="md:hidden">
          <MobileMenu
            links={mobileLinks}
            isAuth={isAuth}
            role={role}
            avatarUrl={avatar_url}
            fullName={full_name}
          />
        </div>

        {/* Logo: centrado en móvil, alineado a la izquierda en desktop */}
        <Link
          href={leftHref}
          className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 flex items-center"
        >
          <Image
            src="/handee-logo.png"
            alt="Handee"
            width={64}
            height={64}
            priority
            className="h-16 w-16 object-contain"
          />
        </Link>

        {/* Navegación derecha - desktop */}
        <nav className="hidden md:flex items-center gap-2">
          {rightLinks.map((l) => {
            const isRequests = l.href.startsWith("/requests");
            return (
              <Button
                key={l.href}
                asChild
                size={l.size ?? "sm"}
                variant={l.variant ?? "outline"}
                className={isRequests ? "!text-[#11314B] hover:!text-[#11314B]" : undefined}
              >
                <Link href={l.href}>{l.label}</Link>
              </Button>
            );
          })}
          {isAuth ? (
            <details className="relative">
              <summary className="list-none inline-flex items-center rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none cursor-pointer">
                <Avatar className="h-8 w-8">
                  {avatar_url ? <AvatarImage src={avatar_url} alt={full_name ?? "Usuario"} /> : null}
                  <AvatarFallback>
                    {(full_name?.trim()?.split(/\s+/)?.map((p) => p[0])?.slice(0, 2)?.join("") || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-md border bg-white shadow-md p-1 z-50">
                <div className="px-2 py-1.5 text-sm font-semibold">{full_name ?? "Cuenta"}</div>
                <div className="my-1 h-px bg-neutral-200" />
                <Link href="/me" className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">Mi perfil</Link>
                <Link href="/profile/setup" className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">Configura tu perfil</Link>
                <Link href="/settings" className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">Configuración</Link>
                <div className="my-1 h-px bg-neutral-200" />
                <form action="/auth/sign-out" method="post">
                  <button type="submit" className="w-full text-left block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">Salir</button>
                </form>
              </div>
            </details>
          ) : null}
        </nav>

        {/* Lado derecho - móvil y CTA secundarios (sin botón de menú) */}
        <div className="md:hidden flex items-center gap-2">
          {!isAuth ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/auth/sign-in">Iniciar sesión</Link>
            </Button>
          ) : (
            <Link href="/me" className="inline-flex items-center">
              <Avatar className="h-8 w-8">
                {avatar_url ? <AvatarImage src={avatar_url} alt={full_name ?? "Usuario"} /> : null}
                <AvatarFallback>
                  {(full_name?.trim()?.split(/\s+/)?.map((p) => p[0])?.slice(0, 2)?.join("") || "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
