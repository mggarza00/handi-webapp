"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function HideHeaderLoginButtons() {
  const pathname = usePathname();
  useEffect(() => {
    const target = "/auth/sign-in";
    const body = document.body;
    if (pathname === target) {
      body.classList.add("hide-login-buttons");
    } else {
      body.classList.remove("hide-login-buttons");
    }
    return () => {
      body.classList.remove("hide-login-buttons");
    };
  }, [pathname]);

  return null;
}
