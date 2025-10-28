"use client";
import { usePathname } from "next/navigation";

import Breadcrumbs from "@/components/admin/Breadcrumbs.client";

const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/requests": "Solicitudes",
  "/admin/professionals": "Profesionales",
  "/admin/clients": "Clientes",
  "/admin/offers": "Ofertas",
  "/admin/payments": "Pagos",
  "/admin/settings": "Configuración",
  "/admin/system": "Sistema",
};

export default function AdminHeader() {
  const pathname = (usePathname() || "/").replace(/\/$/, "");
  let key = pathname;
  // Normaliza rutas con segmentos variables
  const keys = Object.keys(TITLES).sort((a, b) => b.length - a.length);
  for (const k of keys) if (pathname === k || pathname.startsWith(k + "/")) { key = k; break; }
  const title = TITLES[key] || "Admin";

  return (
    <div className="mb-4 space-y-2">
      <Breadcrumbs />
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
    </div>
  );
}
