"use client";

import * as React from "react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ActiveUserTypeSwitcher from "@/components/ActiveUserTypeSwitcher.client";

export default function AvatarMenu({
  avatarUrl,
  fullName,
}: {
  avatarUrl?: string | null;
  fullName?: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const detailsRef = React.useRef<HTMLDetailsElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <details
      ref={detailsRef}
      className="relative"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="list-none inline-flex items-center rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none cursor-pointer">
        <Avatar className="h-8 w-8">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={fullName ?? "Usuario"} />
          ) : null}
          <AvatarFallback>
            {(fullName
              ?.trim()
              ?.split(/\s+/)
              ?.map((p) => p[0])
              ?.slice(0, 2)
              ?.join("") || "U"
            ).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </summary>
      <div className="absolute right-0 mt-2 w-56 rounded-md border bg-white shadow-md p-1 z-50">
        <div className="px-2 py-1.5 text-sm font-semibold">{fullName ?? "Cuenta"}</div>
        <div className="my-1 h-px bg-neutral-200" />
        <Link href="/me" className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">
          Mi perfil
        </Link>
        <Link href="/profile/setup" className="block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">
          Configura tu perfil
        </Link>
        <ActiveUserTypeSwitcher />
        <div className="my-1 h-px bg-neutral-200" />
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="w-full text-left block rounded px-2 py-1.5 text-sm hover:bg-neutral-100">
            Salir
          </button>
        </form>
      </div>
    </details>
  );
}
