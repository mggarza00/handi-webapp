"use client";

import { Menu } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface NavLink { href: string; label: string; }

const DEFAULT_LINKS: NavLink[] = [
  { href: "/requests", label: "Solicitudes" },
  { href: "/requests/new", label: "Publicar solicitud" },
  { href: "/dashboard/pro", label: "Panel Pro" },
  { href: "/dashboard/client", label: "Panel Cliente" },
  { href: "/profile", label: "Perfil" },
];

export default function MobileMenu({ links }: { links?: NavLink[] }) {
  const items = (links && links.length > 0 ? links : DEFAULT_LINKS);

  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Abrir menú">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Handee</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-2">
            {items.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-base hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
