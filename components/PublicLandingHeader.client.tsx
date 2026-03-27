"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MouseEvent, useEffect, useRef, useState } from "react";

import { openHomeSignInModal } from "@/lib/auth/home-sign-in-modal";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  isActive?: boolean;
};

type Props = {
  items: NavItem[];
  logoHref: string;
  loginHref: string;
};

export default function PublicLandingHeader({
  items,
  logoHref,
  loginHref,
}: Props) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const mobileMenuId = "public-landing-header-mobile-menu";

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLoginClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isHome) return;
    event.preventDefault();
    openHomeSignInModal();
    closeMobileMenu();
  };

  useEffect(() => {
    closeMobileMenu();
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const onMouseDown = (event: globalThis.MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        closeMobileMenu();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileMenuOpen]);

  return (
    <div ref={menuRef} className="handi-header-public-content">
      <div className="handi-header-row handi-header-row--desktop">
        <div className="header-left">
          <Link href={logoHref} className="header-logo" aria-label="Handi">
            <Image
              src="/images/LOGO_HEADER_DB.png"
              alt="Handi"
              width={180}
              height={42}
              className="logo-blue"
              priority={false}
            />
            <Image
              src="/images/LOGO_HEADER_B.png"
              alt="Handi"
              width={180}
              height={42}
              className="logo-white"
              priority={false}
            />
          </Link>
        </div>
        <div className="header-center">
          <nav
            className="header-nav"
            aria-label="Navegación principal (pública)"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-pill ${item.isActive ? "nav-pill--active" : ""}`.trim()}
              >
                <span className="nav-label">{item.label}</span>
                <Image
                  src={item.icon}
                  alt=""
                  className="nav-pill-icon"
                  width={20}
                  height={20}
                />
              </Link>
            ))}
          </nav>
        </div>
        <div className="header-right">
          <Link
            href={loginHref}
            className="login-pill"
            onClick={handleLoginClick}
          >
            <span className="login-label">Iniciar sesión</span>
            <Image
              src="/icons/Vector_inicio.svg"
              alt=""
              className="login-pill-icon"
              width={20}
              height={20}
            />
          </Link>
        </div>
      </div>

      <div className="handi-header-row handi-header-row-mobile">
        <div className="header-logo">
          <Link href={logoHref} aria-label="Handi">
            <Image
              src="/images/LOGO_HEADER_DB.png"
              alt="Handi"
              width={160}
              height={40}
              priority={false}
              className="logo-blue"
            />
            <Image
              src="/images/LOGO_HEADER_B.png"
              alt="Handi"
              width={160}
              height={40}
              priority={false}
              className="logo-white"
            />
          </Link>
        </div>

        <button
          type="button"
          className="mobile-menu-toggle mobile-menu-toggle--login inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-white/20 bg-black/55 p-3 text-white shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] backdrop-blur transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/85"
          onClick={toggleMobileMenu}
          aria-label={
            isMobileMenuOpen ? "Cerrar menú" : "Abrir menú de inicio de sesión"
          }
          aria-expanded={isMobileMenuOpen}
          aria-controls={isMobileMenuOpen ? mobileMenuId : undefined}
        >
          <span className="mobile-menu-icon" aria-hidden="true">
            <span className="block h-0.5 w-5 rounded-full bg-current" />
            <span className="mt-1.5 block h-0.5 w-5 rounded-full bg-current" />
            <span className="mt-1.5 block h-0.5 w-5 rounded-full bg-current" />
          </span>
        </button>
      </div>

      {isMobileMenuOpen ? (
        <div
          id={mobileMenuId}
          className="mobile-menu-dropdown absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-white/12 bg-[#081735]/95 text-white shadow-[0_18px_42px_-18px_rgba(0,0,0,0.7)] ring-1 ring-black/10 backdrop-blur"
        >
          <nav
            className="mobile-menu-nav"
            aria-label="Menú de inicio de sesión"
          >
            <Link
              href={loginHref}
              className="mobile-menu-item flex min-h-[44px] items-center justify-between gap-3 px-4 py-3 text-sm font-medium hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
              onClick={handleLoginClick}
            >
              <span>Iniciar sesión</span>
              <Image
                src="/icons/Vector_inicio.svg"
                alt=""
                width={20}
                height={20}
                className="[filter:brightness(0)_saturate(100%)_invert(100%)]"
              />
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
