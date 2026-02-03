"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function HideHeaderRequestsLink() {
  const pathname = usePathname();
  useEffect(() => {
    const body = document.body;
    const target = "/onboarding/elige-rol";
    if (pathname === target) {
      body.classList.add("hide-requests-link");
    } else {
      body.classList.remove("hide-requests-link");
    }
    return () => {
      body.classList.remove("hide-requests-link");
    };
  }, [pathname]);

  return null;
}
