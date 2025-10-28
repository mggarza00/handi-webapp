import { LayoutDashboard, Boxes, ShieldCheck, Users, CreditCard, Settings, FileWarning } from "lucide-react";

import NavLink from "@/components/admin/NavLink.client";

export default function AdminSidebar() {
  const nav = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/requests", label: "Solicitudes", icon: Boxes },
    { href: "/admin/professionals", label: "Profesionales", icon: ShieldCheck },
    { href: "/admin/clients", label: "Clientes", icon: Users },
    { href: "/admin/offers", label: "Ofertas", icon: CreditCard },
    { href: "/admin/payments", label: "Pagos", icon: CreditCard },
    { href: "/admin/settings", label: "Configuración", icon: Settings },
    { href: "/admin/system", label: "Sistema", icon: FileWarning },
  ];
  return (
    <aside className="sticky top-[calc(4rem+1px)] hidden h-[calc(100dvh-4rem-1px)] shrink-0 border-r md:block">
      <div className="flex h-full flex-col gap-3 p-3">
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
