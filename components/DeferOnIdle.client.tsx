"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type DeferOnIdleProps = {
  children: ReactNode;
  fallback?: ReactNode;
  delayMs?: number;
  timeoutMs?: number;
};

export default function DeferOnIdle({
  children,
  fallback = null,
  delayMs = 0,
  timeoutMs = 2000,
}: DeferOnIdleProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const activate = () => {
      setReady(true);
    };

    const schedule = () => {
      if (delayMs > 0) {
        timeoutHandle = window.setTimeout(activate, delayMs);
        return;
      }
      activate();
    };

    if (win.requestIdleCallback) {
      idleHandle = win.requestIdleCallback(schedule, { timeout: timeoutMs });
    } else {
      timeoutHandle = window.setTimeout(schedule, timeoutMs);
    }

    return () => {
      if (idleHandle !== null && win.cancelIdleCallback) {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [delayMs, timeoutMs]);

  if (!ready) return <>{fallback}</>;
  return <>{children}</>;
}
