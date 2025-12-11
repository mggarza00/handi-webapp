/* eslint-disable import/order */
import Image from "next/image";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import createClient from "@/utils/supabase/server";
import { cookies } from "next/headers";
import localFont from "next/font/local";

import MobileMenu from "@/components/mobile-menu";
import { Button } from "@/components/ui/button";
// Avatar visuals handled by AvatarDropdown for both desktop and mobile
import HeaderMenu from "@/components/header-menu.client";
import ProMobileTabbar from "@/components/pro-mobile-tabbar.client";
import AvatarDropdown from "@/components/AvatarDropdown.client";
import HeaderAuthRefresh from "@/components/HeaderAuthRefresh.client";
import type { Database } from "@/types/supabase";
import ClientNoSessionOnly from "@/components/ClientNoSessionOnly.client";
import PublicLandingHeader from "@/components/PublicLandingHeader.client";
import HeaderLogoSwap from "@/components/HeaderLogoSwap.client";
import CreateRequestButton from "@/components/requests/CreateRequestButton";

type Role = "client" | "pro" | "admin";

const stackSansText = localFont({
  src: "../public/fonts/Stack_Sans_Text/static/StackSansText-Regular.ttf",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-stack-sans-text",
});

export const dynamic = "force-dynamic";

async function getSessionInfo() {
  noStore();
  const supabase = createClient();
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
    // Autoaprovisionar perfil mÃ­nimo en primer login
    try {
      const profTable = supabase.from("profiles");
      type Insert = Database["public"]["Tables"]["profiles"]["Insert"];
      const insert = profTable.insert as unknown as (
        values: Insert,
      ) => ReturnType<typeof profTable.insert>;
      await insert({
        id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      } as Insert);
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
  let proProfile: {
    avatar_url: string | null;
    full_name: string | null;
  } | null = null;
  if (!profile?.avatar_url || !profile?.full_name) {
    const { data: proRaw } = await supabase
      .from("professionals")
      .select("avatar_url, full_name")
      .eq("id", user.id)
      .maybeSingle();
    proProfile =
      (proRaw as unknown as {
        avatar_url: string | null;
        full_name: string | null;
      } | null) ?? null;
  }
  const role = (profile?.role ?? null) as Role | null;
  type UserMeta = { avatar_url?: string | null; full_name?: string | null };
  const meta = (user.user_metadata as unknown as UserMeta) || {};
  const pickNonEmpty = (...values: Array<string | null | undefined>) => {
    for (const value of values) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
    return null;
  };
  const avatarUrl = pickNonEmpty(
    profile?.avatar_url,
    proProfile?.avatar_url,
    meta.avatar_url,
  );
  const fullName = pickNonEmpty(
    profile?.full_name,
    proProfile?.full_name,
    meta.full_name,
  );
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
    // Mock de rol para dev/CI: si existe cookie 'handi_role' (o legacy 'handee_role'), simula sesiÃ³n
    // VÃ¡lido sÃ³lo fuera de producciÃ³n o con CI=true
    try {
      const allowMock =
        process.env.NODE_ENV !== "production" || process.env.CI === "true";
      if (allowMock) {
        const c = cookies();
        const mock =
          c.get("handi_role")?.value || c.get("handee_role")?.value || "guest";
        const m = mock as "guest" | "client" | "professional" | "admin";
        if (m !== "guest") {
          const mappedRole: Role =
            m === "professional" ? "pro" : (m as "client" | "admin");
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
      <header
        className={`${stackSansText.className} ${stackSansText.variable} fixed top-0 left-0 right-0 z-50 border-b border-border bg-neutral-50/80 dark:bg-neutral-900/40 backdrop-blur-md`}
      >
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/Logo-Handi-v2.gif"
              alt="Handi"
              width={64}
              height={64}
              priority
              className="h-16 w-16 object-contain"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-2" />
        </div>
      </header>
    );
  }
  const { isAuth, role, is_admin, is_client_pro, avatar_url, full_name } =
    await getSessionInfoSafe();
  const cookieStore = cookies();
  const proApply =
    cookieStore.get("handi_pro_apply")?.value === "1" ||
    cookieStore.get("handee_pro_apply")?.value === "1";

  // El logo siempre debe redirigir a la pÃ¡gina de inicio
  const leftHref = "/";
  const publicNavItems = [
    {
      href: "/#servicios-populares",
      label: "Servicios",
      icon: "/icons/servicios_icon.svg",
      isActive: true,
    },
    {
      href: "/#como-funciona",
      label: "Como funciona",
      icon: "/icons/engrane_icon.svg",
    },
    {
      href: "/#profesionales-cerca-de-ti",
      label: "Cerca de ti",
      icon: "/icons/loc_icon.svg",
    },
  ];

  let rightLinks: {
    href: string;
    label: string;
    variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
    size?: "sm" | "lg" | "default";
    className?: string;
    testId?: string;
  }[] = [];
  // Eliminado botÃ³n "Biblioteca" del header/menÃº
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
        href: "/pro/calendar",
        label: "Calendario",
        variant: "ghost",
        size: "sm",
        className: "h-[2.125rem] px-[1.275rem] hover:bg-neutral-200",
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

  // Asegurar que "Mis solicitudes" estÃ© visible solo para clientes (o rol aÃºn no asignado) y administradores
  if (
    !proApply &&
    isAuth &&
    (role === "client" || role == null || role === "admin" || is_admin)
  ) {
    const hasRequestsLink = rightLinks.some((l) =>
      l.href.startsWith("/requests"),
    );
    if (!hasRequestsLink) {
      const href =
        role === "admin" || is_admin ? "/requests" : "/requests?mine=1";
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

  // Enlaces para el menÃº mÃ³vil (excluye iniciar sesiÃ³n; apariencia idÃ©ntica al header)
  const mobileLinks = (() => {
    const base = rightLinks.filter((x) => x.href !== "/auth/sign-in");
    // Para profesionales, ocultar en el menÃº mÃ³vil los botones que ya estÃ¡n en el tab bar
    if (role === "pro") {
      return base.filter(
        (l) =>
          l.href !== "/requests/explore" &&
          l.href !== "/applied" &&
          l.href !== "/pro/calendar",
      );
    }
    // Para clientes, ocultar "Nueva solicitud" y "Mis solicitudes" en el menú lateral móvil
    if (role === "client") {
      return base.filter(
        (l) =>
          l.href !== "/requests/new" &&
          l.href !== "/requests?mine=1" &&
          l.label !== "Mis solicitudes",
      );
    }
    return base;
  })();

  return (
    <>
      {/* If SSR thinks unauth but client has session, trigger a gentle refresh */}
      {!isAuth ? <HeaderAuthRefresh enabled={!isAuth} /> : null}
      <header
        className={`${stackSansText.className} ${stackSansText.variable} handi-header header--default fixed top-0 left-0 right-0 z-50`}
        data-authenticated={isAuth ? "1" : "0"}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/8 to-transparent"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-6">
          <div className="handi-header-public hidden w-full">
            <PublicLandingHeader
              items={publicNavItems}
              logoHref={leftHref}
              loginHref="/auth/sign-in"
            />
          </div>
          <div className="handi-header__default relative flex h-16 w-full items-center justify-between">
            {/* Lado izquierdo: botÃ³n menÃº mÃ³vil (solo autenticado) */}
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

            {/* Logo: centrado en mÃ³vil, alineado a la izquierda en desktop */}
            <HeaderLogoSwap
              href={leftHref}
              swapOnLanding={!isAuth}
              className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 flex items-center"
              width={128}
              height={128}
            />

            {/* Navegacion publica centrada (solo invitado, desktop) */}
            {!isAuth ? (
              <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center">
                <div className="flex items-center gap-1 rounded-full bg-black/20 px-2 py-1 backdrop-blur">
                  <Link
                    href="/#servicios-populares"
                    className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-[#0C2555]"
                  >
                    <Image
                      src="/icons/servicios_icon.svg"
                      alt=""
                      width={18}
                      height={18}
                      className="h-4 w-4 [filter:brightness(0)_saturate(100%)_invert(100%)] group-hover:[filter:brightness(0)_saturate(100%)_invert(17%)_sepia(51%)_saturate(2204%)_hue-rotate(195deg)_brightness(90%)_contrast(101%)]"
                    />
                    <span>Servicios</span>
                  </Link>
                  <Link
                    href="/#como-funciona"
                    className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-[#0C2555]"
                  >
                    <Image
                      src="/icons/engrane_icon.svg"
                      alt=""
                      width={18}
                      height={18}
                      className="h-4 w-4 [filter:brightness(0)_saturate(100%)_invert(100%)] group-hover:[filter:brightness(0)_saturate(100%)_invert(17%)_sepia(51%)_saturate(2204%)_hue-rotate(195deg)_brightness(90%)_contrast(101%)]"
                    />
                    <span>Cómo funciona</span>
                  </Link>
                  <Link
                    href="/#profesionales-cerca-de-ti"
                    className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-[#0C2555]"
                  >
                    <Image
                      src="/icons/loc_icon.svg"
                      alt=""
                      width={18}
                      height={18}
                      className="h-4 w-4 [filter:brightness(0)_saturate(100%)_invert(100%)] group-hover:[filter:brightness(0)_saturate(100%)_invert(17%)_sepia(51%)_saturate(2204%)_hue-rotate(195deg)_brightness(90%)_contrast(101%)]"
                    />
                    <span>Cerca de ti</span>
                  </Link>
                </div>
              </nav>
            ) : null}

            {/* Botones centrados (cliente y profesional) - desktop */}
            {role === "client" ? (
              <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center">
                <div className="flex items-center gap-1 rounded-full bg-black/20 px-2 py-1 backdrop-blur">
                  {/* Orden: Mis solicitudes (izq), Nueva Solicitud (der) */}
                  {rightLinks
                    .filter(
                      (l) =>
                        l.label === "Mis solicitudes" ||
                        l.label === "Nueva solicitud",
                    )
                    .sort((a, _b) => (a.label === "Mis solicitudes" ? -1 : 1))
                    .map((l) =>
                      l.label === "Nueva solicitud" ? (
                        <CreateRequestButton
                          key={l.href}
                          variant="ghost"
                          size="sm"
                          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-[#0C2555] whitespace-nowrap pl-1 h-auto min-h-0"
                        >
                          <Image
                            src="/images/icono-nueva-solicitud.gif"
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8"
                          />
                          <span>{l.label}</span>
                        </CreateRequestButton>
                      ) : (
                        <Link
                          key={l.href}
                          href={l.href}
                          data-testid={l.testId}
                          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-[#0C2555] whitespace-nowrap"
                        >
                          {l.label === "Mis solicitudes" ? (
                            <Image
                              src="/images/icono-mis-solicitudes.gif"
                              alt=""
                              width={32}
                              height={32}
                              className="h-8 w-8"
                            />
                          ) : null}
                          <span>{l.label}</span>
                        </Link>
                      ),
                    )}
                </div>
              </div>
            ) : null}

            {role === "pro" ? (
              <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center">
                <div className="flex items-center gap-2 rounded-full bg-black/20 px-2.5 py-1.5 backdrop-blur">
                  {rightLinks
                    .filter(
                      (l) =>
                        l.href === "/requests/explore" ||
                        l.href === "/pro/calendar" ||
                        l.href === "/applied",
                    )
                    .map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        data-testid={l.testId}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm font-normal font-[var(--font-stack-sans-text)] text-white hover:bg-white hover:text-[#0C2555] whitespace-nowrap"
                      >
                        {l.href === "/requests/explore" ? (
                          <Image
                            src="/images/icono-trabajos-disponibles.gif"
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8"
                          />
                        ) : l.href === "/pro/calendar" ? (
                          <Image
                            src="/images/icono-calendario.png"
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
                        <span className="text-center leading-tight w-full">
                          {l.href === "/requests/explore" ? (
                            <>
                              Trabajos
                              <br />
                              disponibles
                            </>
                          ) : l.href === "/applied" ? (
                            <>
                              Trabajos
                              <br />
                              realizados
                            </>
                          ) : (
                            l.label
                          )}
                        </span>
                      </Link>
                    ))}
                </div>
              </div>
            ) : null}

            {/* NavegaciÃ³n derecha - desktop */}
            <nav className="hidden md:flex items-center gap-2">
              {rightLinks
                // Evitar duplicar los botones centrados del cliente y profesional
                .filter((l) => {
                  if (
                    role === "client" &&
                    (l.label === "Mis solicitudes" ||
                      l.label === "Nueva solicitud")
                  ) {
                    return false;
                  }
                  if (
                    role === "pro" &&
                    (l.href === "/requests/explore" ||
                      l.href === "/pro/calendar" ||
                      l.href === "/applied")
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((l) => {
                  const isRequests =
                    l.href.startsWith("/requests") && !l.className;
                  const isLogin = l.testId === "btn-login";
                  const isNewRequest = l.label === "Nueva solicitud";
                  const variant = l.variant ?? "outline";
                  const wrapLogin = (node: React.ReactNode) =>
                    l.testId === "btn-login" ? (
                      <ClientNoSessionOnly key={l.href}>
                        {node}
                      </ClientNoSessionOnly>
                    ) : (
                      node
                    );
                  const wantsGrayHover =
                    variant !== "default" && variant !== "destructive";
                  const grayHover = wantsGrayHover
                    ? "hover:bg-neutral-200"
                    : "";
                  const extra = l.className
                    ? `${l.className} ${grayHover}`.trim()
                    : [
                        grayHover,
                        isRequests
                          ? "!text-[#11304A] hover:!text-[#11304A]"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                  if (isLogin) {
                    const pillClass =
                      "group inline-flex items-center gap-2 rounded-full bg-black/20 px-3.5 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white hover:text-[#0C2555]";
                    return wrapLogin(
                      <Link
                        key={l.href}
                        href={l.href}
                        data-testid={l.testId}
                        className={pillClass}
                      >
                        <span>Iniciar sesión</span>
                        <Image
                          src="/icons/Vector_inicio.svg"
                          alt=""
                          width={16}
                          height={16}
                          className="h-4 w-4 [filter:brightness(0)_saturate(100%)_invert(100%)] group-hover:[filter:brightness(0)_saturate(100%)_invert(17%)_sepia(51%)_saturate(2204%)_hue-rotate(195deg)_brightness(90%)_contrast(101%)]"
                        />
                      </Link>,
                    );
                  }
                  if (isNewRequest) {
                    return (
                      <CreateRequestButton
                        key={l.href}
                        variant={l.variant ?? "ghost"}
                        size="sm"
                        className={[
                          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-[#0C2555] whitespace-nowrap pl-1 h-auto min-h-0",
                          extra,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Image
                          src="/images/icono-nueva-solicitud.gif"
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8"
                        />
                        <span>{l.label}</span>
                      </CreateRequestButton>
                    );
                  }
                  // Si es el botÃ³n de login, renderiza normal y ocÃºltalo en cliente si ya hay sesiÃ³n
                  return wrapLogin(
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
                        {isLogin ? (
                          <Image
                            src="/icons/Vector_inicio.svg"
                            alt=""
                            width={16}
                            height={16}
                            className="h-4 w-4"
                          />
                        ) : null}
                      </Link>
                    </Button>,
                  );
                })}

              {/* Notificaciones se administran en /settings; se removió del header */}

              {isAuth ? (
                <AvatarDropdown
                  avatarUrl={avatar_url}
                  fullName={full_name}
                  role={role}
                  isClientPro={is_client_pro}
                />
              ) : null}
              {/* BotÃ³n de menÃº a la derecha del avatar; solo autenticado */}
              {isAuth ? (
                <div className="ml-4">
                  <HeaderMenu />
                </div>
              ) : null}
            </nav>

            {/* Lado derecho - mÃ³vil y CTA secundarios (sin botÃ³n de menÃº) */}
            <div className="md:hidden flex items-center gap-2">
              {!isAuth ? (
                <ClientNoSessionOnly>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href="/auth/sign-in"
                      className="inline-flex items-center gap-2"
                    >
                      <span>Iniciar sesión</span>
                      <Image
                        src="/icons/Vector_inicio.svg"
                        alt=""
                        width={16}
                        height={16}
                        className="h-4 w-4"
                      />
                    </Link>
                  </Button>
                </ClientNoSessionOnly>
              ) : (
                <AvatarDropdown
                  avatarUrl={avatar_url}
                  fullName={full_name}
                  role={role}
                  isClientPro={is_client_pro}
                />
              )}
            </div>
          </div>
        </div>
      </header>
      {/* Pro mobile tabbar removed as requested */}
      {isAuth && role === "pro" ? <ProMobileTabbar /> : null}
    </>
  );
}
/* eslint-disable import/order */
