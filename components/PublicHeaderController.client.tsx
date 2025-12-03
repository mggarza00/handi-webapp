"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PublicHeaderController() {
  const pathname = usePathname() || "";

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".handi-header");
    if (!header) return;
    const isAuth = header.dataset.authenticated === "1";
    let observer: IntersectionObserver | null = null;

    const disable = () => {
      header.classList.remove("handi-header--public-mode", "header--on-hero");
      header.classList.add("header--default");
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };

    if (isAuth || pathname !== "/") {
      disable();
      return () => {
        if (observer) observer.disconnect();
      };
    }

    header.classList.add("handi-header--public-mode", "header--on-hero");
    header.classList.remove("header--default");

    const sentinel = document.getElementById("hero-sentinel");
    if (!sentinel) {
      return () => {
        disable();
      };
    }

    observer = new IntersectionObserver(
      ([entry]) => {
        const onHero = entry?.isIntersecting ?? false;
        if (onHero) {
          header.classList.add("header--on-hero");
          header.classList.remove("header--default");
        } else {
          header.classList.add("header--default");
          header.classList.remove("header--on-hero");
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);

    return () => {
      disable();
    };
  }, [pathname]);

  return null;
}
