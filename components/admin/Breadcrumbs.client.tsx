"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  admin: "Admin",
  requests: "Solicitudes",
  professionals: "Profesionales",
  clients: "Clientes",
  offers: "Ofertas",
  payments: "Pagos",
  settings: "Configuración",
  system: "Sistema",
};

export default function Breadcrumbs() {
  const pathname = (usePathname() || "/").replace(/\/$/, "");
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [] as Array<{ href: string; label: string; current: boolean }>;
  let href = "";
  for (let i = 0; i < parts.length; i++) {
    href += `/${parts[i]}`;
    const label = LABELS[parts[i]] || decodeURIComponent(parts[i]);
    crumbs.push({ href, label, current: i === parts.length - 1 });
  }
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex items-center gap-1.5">
        {crumbs.map((c, i) => (
          <li key={c.href} className="inline-flex items-center gap-1">
            {i > 0 ? <span className="opacity-60">/</span> : null}
            {c.current ? (
              <span aria-current="page" className="text-foreground">{c.label}</span>
            ) : (
              <Link href={c.href} className="hover:text-foreground">{c.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

