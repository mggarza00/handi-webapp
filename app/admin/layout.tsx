/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Boxes, CreditCard, FileWarning, LayoutDashboard, Settings, ShieldCheck, FileText } from "lucide-react";

import createClient from "@/utils/supabase/server";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import NavLink from "@/components/admin/NavLink.client";
import AdminHeader from "@/components/admin/AdminHeader.client";
import { canAccessAdmin } from "@/lib/rbac";
import AdminCollapseToggle from "@/components/admin/AdminCollapseToggle.client";
import AdminTopbar from "@/components/admin/AdminTopbar.client";

export const dynamic = "force-dynamic";

function isLocalAdminBypassAllowed() {
  // E2E-only admin bypass: requires explicit env, non-production, localhost host.
  if (process.env.E2E_ADMIN_BYPASS !== "1") return false;
  if (process.env.NODE_ENV === "production") return false;
  const host = headers().get("x-forwarded-host") || headers().get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let fullName: string | null = null;
  let avatarUrl: string | null = null;
  let role: string | null = null;
  let is_admin: boolean | null = null;
  const cookieStore = cookies();
  const cookieRole = (cookieStore.get("handi_role")?.value || "").toLowerCase();
  const allowDevBypass =
    !user &&
    isLocalAdminBypassAllowed() &&
    ["owner", "admin", "ops", "finance", "support", "reviewer"].includes(cookieRole);
  if (!user && !allowDevBypass) {
    redirect("/auth/sign-in");
  }
  if (allowDevBypass) {
    fullName = "Admin Dev";
    avatarUrl = null;
    role = "admin";
    is_admin = true;
  } else if (user) {
    type ProfRow = {
      full_name: string | null;
      avatar_url: string | null;
      role?: string | null;
      is_admin?: boolean | null;
    } | null;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, role, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    const row = (prof as unknown as ProfRow) || null;
    fullName = row?.full_name ?? null;
    avatarUrl = row?.avatar_url ?? null;
    role = (row?.role ?? null) as string | null;
    is_admin = (row?.is_admin ?? null) as boolean | null;
  }

  const seed = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const allowedByEmail = user?.email && seed ? user.email.toLowerCase() === seed : false;
  const allowed = allowDevBypass || canAccessAdmin(role, is_admin) || Boolean(allowedByEmail);
  if (!allowed) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold">Acceso restringido</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta sección es exclusiva para el equipo de administradores de Handi.
        </p>
        <div className="mt-6">
          <Link className={cn(buttonVariants({ variant: "default" }))} href="/" prefetch={false}>
            Ir al inicio
          </Link>
        </div>
      </main>
    );
  }

  const nav = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, testId: "admin-nav-dashboard" },
    { href: "/admin/offers", label: "Ofertas", icon: CreditCard, testId: "admin-nav-offers" },
    { href: "/admin/requests", label: "Solicitudes", icon: Boxes, testId: "admin-nav-requests" },
    { href: "/admin/professionals", label: "Profesionales", icon: ShieldCheck, testId: "admin-nav-professionals" },
    { href: "/admin/pro-applications", label: "Postulaciones", icon: FileText, testId: "admin-nav-pro-applications" },
    { href: "/admin/pro-changes", label: "Cambios de perfil", icon: FileText, testId: "admin-nav-pro-changes" },
    { href: "/admin/payments", label: "Pagos", icon: CreditCard, testId: "admin-nav-payments" },
    { href: "/admin/settings", label: "Configuración", icon: Settings, testId: "admin-nav-settings" },
    { href: "/admin/system", label: "Sistema", icon: FileWarning, testId: "admin-nav-system" },
  ];

  const stubs = [
    { href: "/admin/clients", label: "Clientes" },
    { href: "/admin/payouts", label: "Payouts" },
    { href: "/admin/disputas", label: "Disputas" },
    { href: "/admin/calificaciones", label: "Calificaciones" },
    { href: "/admin/calendario", label: "Calendario" },
    { href: "/admin/mensajes", label: "Mensajes" },
    { href: "/admin/reportes", label: "Reportes" },
    { href: "/admin/catalogo", label: "Catálogo" },
    { href: "/admin/promos", label: "Promos" },
    { href: "/admin/cms", label: "CMS" },
  ];

  return (
    <SidebarProvider>
      {/* Topbar */}
      <AdminTopbar userEmail={user?.email ?? null} fullName={fullName} avatarUrl={avatarUrl} />

      {/* Mobile Sidebar */}
      <Sidebar width={300}>
        <SidebarHeader className="mb-3">Administración</SidebarHeader>
        <SidebarContent>
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.href === "/admin"}
              dataTestId={item.testId ? `${item.testId}-mobile` : undefined}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </SidebarContent>
        <SidebarHeader className="mt-6 mb-2 text-sm uppercase tracking-wider text-muted-foreground">Más</SidebarHeader>
        <SidebarContent>
          {stubs.map((item) => (
            <NavLink key={item.href} href={item.href}>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </SidebarContent>
        <SidebarFooter />
      </Sidebar>

      {/* Desktop shell */}
      <div
        id="admin-shell"
        data-collapsed="false"
        className="group grid grid-cols-1 md:grid-cols-[260px_1fr] data-[collapsed=true]:md:grid-cols-[72px_1fr] gap-x-3 md:gap-x-4"
      >
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 border-r md:block bg-background">
          <div className="flex h-full flex-col gap-3 p-3 overflow-y-auto">
            <div className="flex items-center px-2 pt-1 min-h-9">
              <div className="text-sm font-semibold group-data-[collapsed=true]:hidden">Administración</div>
              <div className="ml-auto">
                <AdminCollapseToggle className="!inline-flex" />
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              {nav.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                exact={item.href === "/admin"}
                title={item.label}
                dataTestId={item.testId ? `${item.testId}-desktop` : undefined}
                className="group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-2 group-data-[collapsed=true]:gap-0"
              >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate group-data-[collapsed=true]:hidden">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="px-2 pt-3 text-xs uppercase tracking-wider text-muted-foreground group-data-[collapsed=true]:hidden">Más</div>
            <nav className="flex flex-col gap-1 group-data-[collapsed=true]:hidden">
              {stubs.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className="group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-2 group-data-[collapsed=true]:gap-0"
                >
                  <span className="truncate group-data-[collapsed=true]:hidden">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>
        <section className="min-h-[70dvh] py-4 md:py-6">
          <div className="mx-auto max-w-7xl px-2 md:px-3">
            <AdminHeader />
            {children}
          </div>
        </section>
      </div>
    </SidebarProvider>
  );
}
