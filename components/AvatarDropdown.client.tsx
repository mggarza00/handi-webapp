"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserTypeInfo from "@/components/UserTypeInfo.client";

type Role = "client" | "pro" | "admin" | null;

export default function AvatarDropdown({
  avatarUrl,
  fullName,
  role,
}: {
  avatarUrl: string | null;
  fullName: string | null;
  role: Role;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const onPointerDown = (e: Event) => {
      const el = detailsRef.current;
      if (!el || !el.open) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      el.open = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const el = detailsRef.current;
      if (!el || !el.open) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        el.open = false;
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const initials = (
    fullName
      ?.trim()
      ?.split(/\s+/)
      ?.map((p) => p[0])
      ?.slice(0, 2)
      ?.join("") || "U"
  ).toUpperCase();

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="list-none inline-flex items-center rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none cursor-pointer"
        data-testid="avatar"
      >
        <Avatar className="h-8 w-8">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName ?? "Usuario"} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </summary>
      <div className="absolute right-0 mt-2 w-56 rounded-md border bg-white shadow-md p-1 z-50">
        <div className="px-2 py-1.5 text-sm font-semibold">{fullName ?? "Cuenta"}</div>
        {/* Tipo de usuario y switch */}
        <UserTypeInfo currentRole={role} />
        <div className="my-1 h-px bg-neutral-200" />
        <Link href="/me" className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">
          Mi perfil
        </Link>
        <Link href="/profile/setup" className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">
          Configura tu perfil
        </Link>
        <Link href="/settings" className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">
          Configuración
        </Link>
        <div className="my-1 h-px bg-neutral-200" />
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="w-full text-left block rounded px-2 py-1.5 text-sm hover:bg-neutral-100"
          >
            Salir
          </button>
        </form>
      </div>
    </details>
  );
}
