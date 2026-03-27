"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { openHomeSignInModal } from "@/lib/auth/home-sign-in-modal";

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
  const menuId = "public-landing-login-menu";

  React.useEffect(() => {
    if (!isHome || !open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isHome, open]);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleLoginClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isHome) return;
    event.preventDefault();
    setOpen(false);
    openHomeSignInModal();
  };

  if (hideOnPage) return null;

  if (!isHome) {
    return (
      <Link
        href={loginHref}
        onClick={handleLoginClick}
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
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/55 p-3 text-white shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] backdrop-blur transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/85"
      >
        <span className="inline-flex flex-col gap-1.5" aria-hidden="true">
          <span className="h-0.5 w-5 rounded-full bg-current" />
          <span className="h-0.5 w-5 rounded-full bg-current" />
          <span className="h-0.5 w-5 rounded-full bg-current" />
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-3 w-52 overflow-hidden rounded-2xl border border-white/12 bg-[#081735]/95 text-white shadow-[0_18px_42px_-18px_rgba(0,0,0,0.7)] ring-1 ring-black/10 backdrop-blur"
        >
          <Link
            href={loginHref}
            onClick={handleLoginClick}
            className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-3 text-sm font-medium hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
          >
            <span>Iniciar sesión</span>
            <Image
              src="/icons/Vector_inicio.svg"
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 object-contain [filter:brightness(0)_saturate(100%)_invert(100%)]"
            />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
