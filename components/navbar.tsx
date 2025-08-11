'use client'
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Search, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { theme, setTheme } = useTheme();
  const [openMenu, setOpenMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommand();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpenCommand]);

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
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70 px-4">
        <div className="flex items-center gap-3">
          {/* Botón menú móvil */}
          <button className="md:hidden p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  onClick={() => setOpenMenu(true)} aria-label="Abrir menú">
            <Menu className="h-5 w-5"/>
          </button>
          <Link href="/" className="font-semibold text-lg tracking-tight text-brand">Handee</Link>
          <nav className="hidden md:flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-300">
            {links.map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenCommand} title="Buscar (Ctrl/Cmd+K)">
            <Search className="mr-2 h-4 w-4" /> Buscar
          </Button>
          <Button variant="outline" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Alternar tema">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Drawer móvil */}
      {openMenu && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenMenu(false)} />
          <aside className="absolute left-0 top-0 h-full w-80 bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-lg">Handee</span>
              <button className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-900" onClick={() => setOpenMenu(false)}>
                <X className="h-5 w-5"/>
              </button>
            </div>
            <ul className="space-y-1">
              {links.map(l => (
                <li key={l.href}>
                  <button
                    className="w-full text-left rounded-xl px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    onClick={() => { router.push(l.href); setOpenMenu(false); }}
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
            {/* Pie con usuario (placeholder) */}
            <div className="absolute bottom-4 left-5 right-5 text-sm text-neutral-500">
              <div className="font-medium">Mauricio Garza Garza</div>
              <div>mggarza00@gmail.com</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
