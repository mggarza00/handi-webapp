"use client";

import Image from "next/image";
import Link from "next/link";

import MobileMenu from "@/components/mobile-menu";
import UserButton from "@/components/user-button";

export default function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo lado izquierdo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/handee-logo.png"
            alt="Handee"
            width={120}
            height={40}
            priority
          />
        </Link>

        {/* Navegación centrada - desktop */}
        <nav className="hidden md:flex gap-6">
          <Link href="/requests" className="hover:text-blue-600">Solicitudes</Link>
          <Link href="/dashboard/client" className="hover:text-blue-600">Dashboard</Link>
          <Link href="/profile" className="hover:text-blue-600">Perfil</Link>
        </nav>

        {/* Botón usuario / login lado derecho */}
        <div className="flex items-center gap-4">
          <UserButton />
          {/* Menú móvil */}
          <div className="md:hidden">
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
