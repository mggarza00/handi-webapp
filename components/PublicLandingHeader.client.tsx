"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MouseEvent, useState } from "react";

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
  const pathname = usePathname();
  const isHome = pathname === "/";
  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const handleLoginClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isHome) return;
    event.preventDefault();
    openHomeSignInModal();
    closeMobileMenu();
  };

  return (
    <div className="handi-header-public-content">
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
          className="mobile-menu-toggle mobile-menu-toggle--login"
          onClick={toggleMobileMenu}
          aria-label={
            isMobileMenuOpen ? "Cerrar menú" : "Abrir menú de inicio de sesión"
          }
          aria-expanded={isMobileMenuOpen}
        >
          <span className="mobile-menu-icon">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div
        className={`mobile-menu-dropdown ${isMobileMenuOpen ? "mobile-menu-dropdown--open" : ""}`.trim()}
        aria-hidden={!isMobileMenuOpen}
      >
        <nav className="mobile-menu-nav" aria-label="Menú de inicio de sesión">
          <Link
            href={loginHref}
            className="mobile-menu-item"
            onClick={handleLoginClick}
          >
            <span>Iniciar sesión</span>
            <Image
              src="/icons/Vector_inicio.svg"
              alt=""
              width={20}
              height={20}
            />
          </Link>
        </nav>
      </div>
    </div>
  );
}
