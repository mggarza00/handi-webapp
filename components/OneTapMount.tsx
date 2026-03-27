"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const OneTap = dynamic(() => import("./OneTap"), { ssr: false });

export default function OneTapMount() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname !== "/") {
      setReady(false);
      return;
    }

    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    let loadHandle: number | null = null;

    const activate = () => {
      if (win.requestIdleCallback) {
        idleHandle = win.requestIdleCallback(() => setReady(true), {
          timeout: 2800,
        });
        return;
      }
      timeoutHandle = window.setTimeout(() => setReady(true), 1200);
    };

    const schedule = () => {
      loadHandle = window.setTimeout(activate, 250);
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      window.removeEventListener("load", schedule);
      if (loadHandle !== null) {
        window.clearTimeout(loadHandle);
      }
      if (idleHandle !== null && win.cancelIdleCallback) {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [pathname]);

  if (pathname !== "/" || !ready) return null;
  return <OneTap />;
}
