import Link from "next/link";

export default function Sidebar() {
  const links = [
    { href: "/", label: "Inicio" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/my-requests", label: "Mis solicitudes" },
    { href: "/applied", label: "Vacantes postuladas" },
    { href: "/jobs", label: "Trabajos disponibles" },
    { href: "/help", label: "Centro de ayuda" },
    { href: "/ads", label: "Publicidad" },
  ];
  return (
    <aside className="hidden md:block w-60 border-r border-neutral-200 dark:border-neutral-800 p-4">
      <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Navegación</div>
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link className="block rounded-xl px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900" href={l.href}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
