"use client";

import { Menu } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarProvider, useSidebar } from "@/components/ui/sidebar";

export interface NavLink {
  href: string;
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "lg" | "default";
}

const DEFAULT_LINKS: NavLink[] = [
  { href: "/requests?mine=1", label: "Solicitudes" },
  { href: "/requests/new", label: "Publicar solicitud" },
  { href: "/dashboard/pro", label: "Panel Pro" },
  { href: "/dashboard/client", label: "Panel Cliente" },
  { href: "/profile", label: "Perfil" },
];

function MenuLinks({ items }: { items: NavLink[] }) {
  const { setOpen } = useSidebar();
  return (
    <nav className="mt-6 flex flex-col gap-2">
      {items.map((l) => (
        <Button
          key={l.href}
          asChild
          variant={l.variant ?? "ghost"}
          size={l.size ?? "default"}
          className="w-full justify-start text-base"
          onClick={() => setOpen(false)}
        >
          <Link href={l.href}>{l.label}</Link>
        </Button>
      ))}
    </nav>
  );
}

function OpenButton() {
  const { setOpen } = useSidebar();
  return (
    <Button variant="outline" size="icon" aria-label="Abrir menú" onClick={() => setOpen(true)}>
      <Menu className="h-5 w-5" />
    </Button>
  );
}

type Role = "client" | "pro" | "admin" | null;

export default function MobileMenu({
  links,
  isAuth = false,
  role = null,
  avatarUrl = null,
  fullName = null,
}: {
  links?: NavLink[];
  isAuth?: boolean;
  role?: Role;
  avatarUrl?: string | null;
  fullName?: string | null;
}) {
  const { setOpen } = useSidebar();
  const items = links && links.length > 0 ? links : DEFAULT_LINKS;

  const requestsLink = items.find((l) => l.href.startsWith("/requests"));
  const otherLinks = items.filter((l) => !l.href.startsWith("/requests"));

  const initials = (fullName?.trim()?.split(/\s+/)?.map((p) => p[0])?.slice(0, 2)?.join("") || "U").toUpperCase();

  return (
    <div className="md:hidden">
      <SidebarProvider>
        <OpenButton />
        <Sidebar side="left" width={320}>
          <SidebarHeader>Handee</SidebarHeader>
          <SidebarContent>
            {role === "client" && requestsLink ? (
              <div className="mt-2">
                <Button
                  asChild
                  size={requestsLink.size ?? "default"}
                  variant={requestsLink.variant ?? "ghost"}
                  className="w-full justify-start text-base"
                  onClick={() => setOpen(false)}
                >
                  <Link href={requestsLink.href}>{requestsLink.label}</Link>
                </Button>
              </div>
            ) : null}
            <MenuLinks items={role === "client" && requestsLink ? otherLinks : items} />
          </SidebarContent>
          <SidebarFooter>
            <Button asChild variant="ghost" className="w-full justify-start text-base" onClick={() => setOpen(false)}>
              <Link href="/help">Centro de ayuda</Link>
            </Button>
            {isAuth ? (
              <details className="mt-1">
                <summary className="list-none flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-100 cursor-pointer">
                  <Avatar className="h-8 w-8">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName ?? "Usuario"} /> : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{fullName ?? "Cuenta"}</span>
                </summary>
                <div className="mt-2 rounded-md border bg-white shadow-md p-1">
                  <div className="px-2 py-1.5 text-sm font-semibold">{fullName ?? "Cuenta"}</div>
                  <div className="my-1 h-px bg-neutral-200" />
                  <Link href="/me" onClick={() => setOpen(false)} className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">Mi perfil</Link>
                  <Link href="/profile/setup" onClick={() => setOpen(false)} className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">Configura tu perfil</Link>
                  <Link href="/settings" onClick={() => setOpen(false)} className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">Configuración</Link>
                  <div className="my-1 h-px bg-neutral-200" />
                  <form action="/auth/sign-out" method="post">
                    <button type="submit" className="w-full text-left block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">Salir</button>
                  </form>
                </div>
              </details>
            ) : null}
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
