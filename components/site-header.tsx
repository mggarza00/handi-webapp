/* eslint-disable import/order */
import Image from "next/image";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import MobileMenu from "@/components/mobile-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { normalizeAvatarUrl } from "@/lib/avatar";
import HeaderMenu from "@/components/header-menu.client";
import ProMobileTabbar from "@/components/pro-mobile-tabbar.client";
import AvatarDropdown from "@/components/AvatarDropdown.client";
import HeaderAuthRefresh from "@/components/HeaderAuthRefresh.client";
import type { Database } from "@/types/supabase";
import ClientNoSessionOnly from "@/components/ClientNoSessionOnly.client";

type Role = "client" | "pro" | "admin";

export const dynamic = "force-dynamic";

async function getSessionInfo() {
  noStore();
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user)
    return {
      isAuth: false as const,
      role: null as null,
  is_admin: false as const,
      avatar_url: null as null,
      full_name: null as null,
    };

  let { data: profileRaw } = await supabase
    .from("profiles")
    .select("role, is_admin, is_client_pro, avatar_url, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileRaw) {
    // Autoaprovisionar perfil mínimo en primer login
    try {
      await supabase.from("profiles").insert({
        id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      } satisfies Database["public"]["Tables"]["profiles"]["Insert"]);
    } catch (err) {
      void err; // ignore insert errors (profile may already exist)
    }
    const retry = await supabase
      .from("profiles")
      .select("role, is_admin, is_client_pro, avatar_url, full_name")
      .eq("id", user.id)
      .maybeSingle();
    profileRaw = retry.data ?? null;
  }
  const profile = (profileRaw ?? null) as null | {
    role: Role | null;
    is_admin: boolean | null;
    is_client_pro?: boolean | null;
    avatar_url: string | null;
    full_name: string | null;
  };
  const role = (profile?.role ?? null) as Role | null;
  type UserMeta = { avatar_url?: string | null; full_name?: string | null };
  const meta = (user.user_metadata as unknown as UserMeta) || {};
  const avatarUrl = profile?.avatar_url ?? meta.avatar_url ?? null;
  const fullName = profile?.full_name ?? meta.full_name ?? null;
  return {
    isAuth: true as const,
    role,
    is_admin: profile?.is_admin === true,
    is_client_pro: profile?.is_client_pro === true,
    avatar_url: avatarUrl,
    full_name: fullName,
  };
}

async function getSessionInfoSafe() {
  try {
    // Mock de rol para dev/CI: si existe cookie 'handi_role' (o legacy 'handee_role'), simula sesión
    // Válido sólo fuera de producción o con CI=true
    try {
      const allowMock =
        process.env.NODE_ENV !== "production" || process.env.CI === "true";
      if (allowMock) {
        const c = cookies();
        const mock = c.get("handi_role")?.value || c.get("handee_role")?.value || "guest";
        const m = mock as "guest" | "client" | "professional" | "admin";
        if (m !== "guest") {
          const mappedRole: Role = m === "professional" ? "pro" : (m as "client" | "admin");
          return {
            isAuth: true as const,
            role: mappedRole,
            is_admin: m === "admin",
            is_client_pro: mappedRole === "pro",
            avatar_url: null as null,
            full_name: null as null,
          };
        }
      }
    } catch {
      // ignore mock errors
    }

    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return {
        isAuth: false as const,
        role: null as null,
        is_admin: false as const,
        is_client_pro: false as const,
        avatar_url: null as null,
        full_name: null as null,
      };
    }
    return await getSessionInfo();
  } catch {
    return {
      isAuth: false as const,
      role: null as null,
      is_admin: false as const,
      is_client_pro: false as const,
      avatar_url: null as null,
      full_name: null as null,
    };
  }
}

export default async function SiteHeader() {
  const minimal = (process.env.NEXT_PUBLIC_HEADER_MINIMAL || "").trim() === "1";
  if (minimal) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-neutral-50/80 dark:bg-neutral-900/40 backdrop-blur-md">
        <div className="relative mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center">
            <Image src="/Logo-Homaid-v1.gif" alt="Homaid" width={64} height={64} priority className="h-16 w-16 object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-2" />
        </div>
      </header>
    );
  }
  const { isAuth, role, is_admin, is_client_pro, avatar_url, full_name } = await getSessionInfoSafe();
  const cookieStore = cookies();
  const proApply =
    cookieStore.get("handi_pro_apply")?.value === "1" ||
    cookieStore.get("handee_pro_apply")?.value === "1";

  // El logo siempre debe redirigir a la página de inicio
  const leftHref = "/";

  let rightLinks: {
    href: string;
    label: string;
    variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
    size?: "sm" | "lg" | "default";
    className?: string;
    testId?: string;
  }[] = [];
  // Eliminado botón "Biblioteca" del header/menú
  if (!isAuth) {
    rightLinks.push({
      href: "/auth/sign-in",
      label: "Iniciar sesión",
      variant: "ghost",
      size: "sm",
      testId: "btn-login",
    });
  } else if (role === "client") {
    rightLinks.push(
      {
        href: "/requests/new",
        label: "Nueva solicitud",
        variant: "ghost",
        size: "lg",
        className: "h-[2.125rem] px-[1.275rem] hover:bg-neutral-200",
      },
      {
        href: "/requests?mine=1",
        label: "Mis solicitudes",
        variant: "ghost",
        size: "lg",
        className: "h-[2.125rem] px-[1.275rem] hover:bg-neutral-200",
        // Marcar nav del cliente para E2E
        testId: "nav-client",
      },
    );
  } else if (role === "pro") {
    // Both pro buttons should use the compact 'Trabajos realizados' design
    rightLinks.push(
      {
        href: "/requests/explore",
        label: "Trabajos disponibles",
        variant: "ghost",
        size: "sm",
        className: "h-[2.125rem] px-[1.275rem] hover:bg-neutral-200",
        // Marcar nav del profesional para E2E
        testId: "nav-professional",
      },
      {
        href: "/applied",
        label: "Trabajos realizados",
        variant: "ghost",
        size: "sm",
        className: "h-[2.125rem] px-[1.275rem] hover:bg-neutral-200",
      },
    );
  } else if (role === "admin" || is_admin) {
    rightLinks.push(
      {
        href: "/admin",
        label: "Panel",
        variant: "default",
        size: "lg",
        // Marcar nav de admin para E2E
        testId: "nav-admin",
      },
      { href: "/admin/users", label: "Usuarios", variant: "ghost", size: "sm" },
      {
        href: "/admin/requests",
        label: "Solicitudes",
        variant: "ghost",
        size: "sm",
      },
      {
        href: "/admin/applications",
        label: "Postulaciones",
        variant: "ghost",
        size: "sm",
      },
      {
        href: "/admin/pro-applications",
        label: "Altas Pro",
        variant: "ghost",
        size: "sm",
      },
      {
        href: "/admin/professionals",
        label: "Profesionales",
        variant: "ghost",
        size: "sm",
      },
    );
  }

  // Asegurar que "Mis solicitudes" esté visible solo para clientes (o rol aún no asignado) y administradores
  if (
    !proApply &&
    isAuth &&
    (role === "client" || role == null || role === "admin" || is_admin)
  ) {
    const hasRequestsLink = rightLinks.some((l) =>
      l.href.startsWith("/requests"),
    );
    if (!hasRequestsLink) {
  const href = role === "admin" || is_admin ? "/requests" : "/requests?mine=1";
      rightLinks.push({
        href,
        label: "Mis solicitudes",
        variant: "ghost",
        size: "sm",
      });
    }
  }

  // Si estamos en flujo de pro-apply, eliminar cualquier enlace a "Mis solicitudes".
  if (proApply) {
    rightLinks = rightLinks.filter(
      (l) =>
        l.label !== "Mis solicitudes" && !/\/requests\?mine=1/.test(l.href),
    );
  }

  // Enlaces para el menú móvil (excluye iniciar sesión; apariencia idéntica al header)
  const mobileLinks = (() => {
    const base = rightLinks.filter((x) => x.href !== "/auth/sign-in");
    // Para profesionales, ocultar en el menú móvil los botones que ya están en el tab bar
    if (role === "pro") {
      return base.filter(
        (l) => l.href !== "/requests/explore" && l.href !== "/applied",
      );
    }
    return base;
  })();

  return (
    <>
    {/* If SSR thinks unauth but client has session, trigger a gentle refresh */}
    {!isAuth ? <HeaderAuthRefresh enabled={!isAuth} /> : null}
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-neutral-50/80 dark:bg-neutral-900/40 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        {/* Lado izquierdo: botón menú móvil (solo autenticado) */}
        {isAuth ? (
          <div className="md:hidden">
            <MobileMenu
              links={mobileLinks}
              isAuth={isAuth}
              role={role}
              avatarUrl={avatar_url}
              fullName={full_name}
              isClientPro={is_client_pro}
            />
          </div>
        ) : (
          <div className="md:hidden" />
        )}

        {/* Logo: centrado en móvil, alineado a la izquierda en desktop */}
        <Link
          href={leftHref}
          className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 flex items-center"
        >
          <Image
            src="/Logo-Homaid-v1.gif"
            alt="Homaid"
            width={64}
            height={64}
            priority
            className="h-16 w-16 object-contain"
          />
        </Link>

        {/* Botones centrados (cliente y profesional) - desktop */}
        {role === "client" ? (
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-2">
            {/* Orden: Mis solicitudes (izq), Nueva Solicitud (der) */}
            {rightLinks
              .filter(
                (l) =>
                  l.label === "Mis solicitudes" ||
                  l.label === "Nueva solicitud",
              )
              .sort((a, _b) => (a.label === "Mis solicitudes" ? -1 : 1))
              .map((l) => (
                <Button
                  key={l.href}
                  asChild
                  size={l.size ?? "sm"}
                  variant={l.variant ?? "outline"}
                  className={[l.className, "w-[12.32rem] justify-center hover:bg-neutral-200"]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Link
                    href={l.href}
                    data-testid={l.testId}
                    className={`inline-flex items-center gap-2 whitespace-nowrap ${l.label === "Nueva solicitud" ? "pl-1" : ""}`}
                  >
                    {l.label === "Mis solicitudes" ? (
                      <Image
                        src="/images/icono-mis-solicitudes.gif"
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8"
                      />
                    ) : l.label === "Nueva solicitud" ? (
                      <Image
                        src="/images/icono-nueva-solicitud.gif"
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8"
                      />
                    ) : null}
                    <span>{l.label}</span>
                  </Link>
                </Button>
              ))}
          </div>
        ) : null}

        {role === "pro" ? (
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-2">
            {rightLinks
              .filter((l) => l.href === "/requests/explore" || l.href === "/applied")
              .map((l) => (
                <Button
                  key={l.href}
                  asChild
                  size={l.size ?? "sm"}
                  variant={l.variant ?? "ghost"}
                  className={[l.className, "w-[12.32rem] justify-center"]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Link
                    href={l.href}
                    data-testid={l.testId}
                    className={`inline-flex items-center gap-2 whitespace-nowrap`}
                  >
                    {l.href === "/requests/explore" ? (
                      <Image
                        src="/images/icono-trabajos-disponibles.gif"
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8"
                      />
                    ) : l.href === "/applied" ? (
                      <Image
                        src="/images/icono-trabajos-realizados.gif"
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8"
                      />
                    ) : null}
                    <span>{l.label}</span>
                  </Link>
                </Button>
              ))}
          </div>
        ) : null}

        {/* Navegación derecha - desktop */}
  <nav className="hidden md:flex items-center gap-2">
          {rightLinks
            // Evitar duplicar los botones centrados del cliente y profesional
            .filter((l) => {
              if (
                role === "client" &&
                (l.label === "Mis solicitudes" || l.label === "Nueva solicitud")
              ) {
                return false;
              }
              if (
                role === "pro" &&
                (l.href === "/requests/explore" || l.href === "/applied")
              ) {
                return false;
              }
              return true;
            })
            .map((l) => {
              const isRequests = l.href.startsWith("/requests") && !l.className;
              const variant = l.variant ?? "outline";
              const wantsGrayHover =
                variant !== "default" && variant !== "destructive";
              const grayHover = wantsGrayHover ? "hover:bg-neutral-200" : "";
              const extra = l.className
                ? `${l.className} ${grayHover}`.trim()
                : [
                    grayHover,
                    isRequests ? "!text-[#11314B] hover:!text-[#11314B]" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
              // Si es el botón de login, renderiza normal y ocúltalo en cliente si ya hay sesión
              const wrapLogin = (node: React.ReactNode) =>
                l.testId === "btn-login" ? <ClientNoSessionOnly key={l.href}>{node}</ClientNoSessionOnly> : node;
              return (
                wrapLogin(
                  <Button
                    key={l.href}
                    asChild
                    size={l.size ?? "sm"}
                    variant={l.variant ?? "outline"}
                    className={extra || undefined}
                  >
                    <Link
                      href={l.href}
                      data-testid={l.testId}
                      className="inline-flex items-center gap-2"
                    >
                      {l.label === "Mis solicitudes" ? (
                        <Image
                          src="/images/icono-mis-solicitudes.gif"
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8"
                        />
                      ) : l.label === "Nueva solicitud" ? (
                        <Image
                          src="/images/icono-nueva-solicitud.gif"
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8"
                        />
                      ) : null}
                      <span>{l.label}</span>
                    </Link>
                  </Button>,
                )
              );
            })}
          
          {isAuth ? (
            <AvatarDropdown avatarUrl={avatar_url} fullName={full_name} role={role} isClientPro={is_client_pro} />
          ) : null}
          {/* Botón de menú a la derecha del avatar; solo autenticado */}
          {isAuth ? (
            <div className="ml-4">
              <HeaderMenu />
            </div>
          ) : null}
        </nav>

        {/* Lado derecho - móvil y CTA secundarios (sin botón de menú) */}
        <div className="md:hidden flex items-center gap-2">
          {!isAuth ? (
            <ClientNoSessionOnly>
              <Button asChild size="sm" variant="outline">
                <Link href="/auth/sign-in">Iniciar sesión</Link>
              </Button>
            </ClientNoSessionOnly>
          ) : (
            <Link href="/me" className="inline-flex items-center">
              <Avatar className="h-8 w-8">
                {normalizeAvatarUrl(avatar_url) ? (
                  <AvatarImage src={normalizeAvatarUrl(avatar_url)!} alt={full_name ?? "Usuario"} />
                ) : null}
                <AvatarFallback>
                  {(
                    full_name
                      ?.trim()
                      ?.split(/\s+/)
                      ?.map((p) => p[0])
                      ?.slice(0, 2)
                      ?.join("") || "U"
                  ).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
        </div>
      </div>
    </header>
  {/* Pro mobile tabbar removed as requested */}
  {isAuth && role === "pro" ? <ProMobileTabbar /> : null}
    </>
  );
}
/* eslint-disable import/order */
