"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function ProMobileTabbar() {
  const pathname = usePathname() || "";
  const isExplore = pathname.startsWith("/requests/explore");
  const isApplied = pathname.startsWith("/applied");

  const base =
    "inline-flex flex-col items-center gap-1 px-3 py-1 rounded-md text-sm text-[#11314B] hover:bg-neutral-200 dark:hover:bg-neutral-800";
  const active = "bg-neutral-200 dark:bg-neutral-800";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 block md:hidden border-t border-border bg-neutral-50/95 dark:bg-neutral-900/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-4 py-2">
        <Link href="/requests/explore" className={`${base} ${isExplore ? active : ""}`.trim()}>
          <Image src="/images/icono-trabajos-disponibles.gif" alt="" width={28} height={28} className="h-6 w-6" />
          <span>Trabajos disponibles</span>
        </Link>
        <Link href="/applied" className={`${base} ${isApplied ? active : ""}`.trim()}>
          <Image src="/images/icono-trabajos-realizados.gif" alt="" width={28} height={28} className="h-6 w-6" />
          <span>Trabajos realizados</span>
        </Link>
      </div>
    </nav>
  );
}
