"use client";

import { useEffect } from "react";

const WARM_IMAGES = [
  "/images/e533c387b9255d160d3c89dacf043df7010ca64b.jpg",
  "/icons/candado_lima.svg",
  "/images/LOGO_HPM_B.png",
  "/images/FAVICON_FOOTER.png",
];

export default function LandingWarmup() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const warm = () => {
      WARM_IMAGES.forEach((src) => {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    if (win.requestIdleCallback) {
      idleHandle = win.requestIdleCallback(warm, { timeout: 2000 });
    } else {
      timeoutHandle = window.setTimeout(warm, 1200);
    }

    return () => {
      if (idleHandle !== null && win.cancelIdleCallback) {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, []);

  return null;
}
