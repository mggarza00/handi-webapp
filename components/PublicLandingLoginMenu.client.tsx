"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu } from "lucide-react";

type Props = {
  loginHref?: string;
};

export default function PublicLandingLoginMenu({
  loginHref = "/auth/sign-in",
}: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const hideOnPage = pathname === "/auth/sign-in";
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isHome || !open) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isHome, open]);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (hideOnPage) return null;

  if (!isHome) {
    return (
      <Link
        href={loginHref}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-slate-800"
      >
        <span>Iniciar sesión</span>
        <Image
          src="/icons/Vector_inicio.svg"
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 object-contain"
        />
      </Link>
    );
  }

  return (
    <div ref={menuRef} className="public-login-menu relative md:hidden">
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú de inicio de sesión"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/20 px-3 py-2 text-white shadow-sm backdrop-blur transition hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl bg-white/95 text-slate-800 shadow-lg ring-1 ring-slate-200 backdrop-blur">
          <Link
            href={loginHref}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-slate-100"
          >
            <span>Iniciar sesión</span>
            <Image
              src="/icons/Vector_inicio.svg"
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 object-contain"
            />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
