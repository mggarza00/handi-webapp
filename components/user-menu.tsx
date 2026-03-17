"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMyProfileHref } from "@/lib/profiles/get-my-profile-href";

type Role = "client" | "pro" | "admin" | null;

export default function UserMenu({
  userId,
  role = null,
  fullName,
  avatarUrl,
}: {
  userId?: string | null;
  role?: Role;
  fullName: string | null;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const initials = (
    fullName
      ?.trim()
      ?.split(/\s+/)
      ?.map((p) => p[0])
      ?.slice(0, 2)
      ?.join("") || "U"
  ).toUpperCase();
  const myProfileHref = getMyProfileHref({ role, userId });

  return (
    <div className="relative" ref={ref}>
      <button
        className="inline-flex items-center gap-2 rounded-full p-1 hover:bg-gray-100"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar className="h-8 w-8">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={fullName ?? "Usuario"} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border bg-white shadow-lg"
        >
          <Link
            href={myProfileHref}
            className="block px-3 py-2 text-sm hover:bg-gray-50"
            role="menuitem"
          >
            Mi perfil
          </Link>
          <Link
            href="/settings"
            className="block px-3 py-2 text-sm hover:bg-gray-50"
            role="menuitem"
          >
            Configuración
          </Link>
          <div className="my-1 h-px bg-gray-100" />
          <Link
            href="/auth/sign-out"
            className="block px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
            role="menuitem"
          >
            Salir
          </Link>
        </div>
      ) : null}
    </div>
  );
}
