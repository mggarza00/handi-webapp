"use client";

import { useEffect } from "react";

const WARM_IMAGES = ["/images/e533c387b9255d160d3c89dacf043df7010ca64b.jpg"];

export default function LandingWarmup() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(max-width: 767px)").matches) return;
    if (
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData
    ) {
      return;
    }

    const warm = () => {
      WARM_IMAGES.forEach((src) => {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const scheduleWarmup = () => {
      if (win.requestIdleCallback) {
        idleHandle = win.requestIdleCallback(warm, { timeout: 4000 });
      } else {
        timeoutHandle = window.setTimeout(warm, 2800);
      }
    };

    if (document.readyState === "complete") {
      scheduleWarmup();
    } else {
      window.addEventListener("load", scheduleWarmup, { once: true });
    }

    return () => {
      window.removeEventListener("load", scheduleWarmup);
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
