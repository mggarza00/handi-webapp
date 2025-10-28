/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import createClient from "@/utils/supabase/server";
import { BadgeDollarSign, Boxes, CreditCard, FileWarning, LayoutDashboard, Settings, ShieldCheck } from "lucide-react";

import { SidebarProvider, Sidebar, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import NavLink from "@/components/admin/NavLink.client";
import AdminHeader from "@/components/admin/AdminHeader.client";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let fullName: string | null = null;
  let avatarUrl: string | null = null;
  if (user) {
    type ProfRow = { full_name: string | null; avatar_url: string | null } | null;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    const row = (prof as unknown as ProfRow) || null;
    fullName = row?.full_name ?? null;
    avatarUrl = row?.avatar_url ?? null;
  }

  const nav = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/offers", label: "Ofertas", icon: CreditCard },
    { href: "/admin/requests", label: "Solicitudes", icon: Boxes },
    { href: "/admin/professionals", label: "Profesionales", icon: ShieldCheck },
    { href: "/admin/payments", label: "Pagos", icon: CreditCard },
    { href: "/admin/settings", label: "Configuración", icon: Settings },
    { href: "/admin/system", label: "Sistema", icon: FileWarning },
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
      <div className="sticky top-16 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <SidebarTrigger className="md:hidden" />
          <div className="flex items-center gap-2 font-semibold">
            <BadgeDollarSign className="h-5 w-5" />
            <span>Homaid Admin</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <input
              type="search"
              placeholder="Buscar..."
              className="h-9 w-48 rounded-md border bg-background px-3 text-sm md:w-64"
            />
            {user ? (
              <>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName || user.email || "usuario"} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted" />
                )}
                <div className="hidden text-sm md:block opacity-70">{fullName || user.email}</div>
                <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/auth/sign-out" prefetch={false}
                >Salir</Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <Sidebar width={300}>
        <SidebarHeader className="mb-3">Administración</SidebarHeader>
        <SidebarContent>
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href}>
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
      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[260px_1fr] gap-0 px-4">
        <aside className="sticky top-[calc(4rem+1px)] hidden h-[calc(100dvh-4rem-1px)] shrink-0 border-r md:block">
          <div className="flex h-full flex-col gap-3 p-3">
            <div className="px-2 pt-1 text-sm font-semibold">Administración</div>
            <nav className="flex flex-col gap-1">
              {nav.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="px-2 pt-3 text-xs uppercase tracking-wider text-muted-foreground">Más</div>
            <nav className="flex flex-col gap-1">
              {stubs.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>
        <section className="min-h-[70dvh] py-4 md:py-6">
          <AdminHeader />
          {children}
        </section>
      </div>
    </SidebarProvider>
  );
}
