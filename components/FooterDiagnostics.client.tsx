"use client";

/*
Footer diagnostics (opt-in):
- Open https://handi.mx/?debugFooter=1
- Scroll to the footer and inspect console logs.
This is a safe, production-only debug flag that reports footer timing,
CLS/long tasks, resource timing, and service worker/cache state.
*/

import { useEffect } from "react";

const DEBUG_PARAM = "debugFooter";
const RESOURCE_WINDOW_MS = 2000;
const SHIFT_WINDOW_MS = 2000;

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has(DEBUG_PARAM) || params.get(DEBUG_PARAM) === "1";
}

function formatNode(node: Node | null): string {
  if (!node || !(node instanceof Element)) return "unknown-node";
  const id = node.id ? `#${node.id}` : "";
  const className =
    typeof node.className === "string" && node.className.trim().length > 0
      ? `.${node.className.trim().replace(/\s+/g, ".")}`
      : "";
  return `${node.tagName.toLowerCase()}${id}${className}`;
}

function logFooterStyles(footer: HTMLElement, label: string) {
  const styles = window.getComputedStyle(footer);
  console.log(`[footer-debug] ${label} styles`, {
    display: styles.display,
    visibility: styles.visibility,
    opacity: styles.opacity,
    contentVisibility: styles.contentVisibility,
    contain: styles.contain,
    position: styles.position,
    height: styles.height,
  });
}

export default function FooterDiagnostics() {
  useEffect(() => {
    if (!isDebugEnabled()) return;

    const startTime = performance.now();
    console.log("[footer-debug] enabled", {
      href: window.location.href,
      time: startTime,
    });

    const footerRef: { current: HTMLElement | null } = { current: null };
    let footerIntersectTime: number | null = null;
    let resourceTimer: ReturnType<typeof setTimeout> | null = null;

    const findFooter = () =>
      document.querySelector("footer") as HTMLElement | null;

    const handleFooterAvailable = (footer: HTMLElement, label: string) => {
      footerRef.current = footer;
      console.log(`[footer-debug] footer available (${label})`, {
        time: performance.now(),
      });
      logFooterStyles(footer, "footer");
      intersectionObserver.observe(footer);
    };

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || footerIntersectTime !== null) return;
          footerIntersectTime = performance.now();
          console.log("[footer-debug] footer intersected viewport", {
            time: footerIntersectTime,
            intersectionRatio: entry.intersectionRatio,
          });

          resourceTimer = setTimeout(() => {
            const after = performance.getEntriesByType(
              "resource",
            ) as PerformanceResourceTiming[];
            const newEntries = after.filter(
              (entryItem) =>
                entryItem.startTime >= footerIntersectTime &&
                entryItem.startTime <= footerIntersectTime + RESOURCE_WINDOW_MS,
            );
            console.log(
              "[footer-debug] resources within 2s after footer intersect",
              newEntries.map((entryItem) => ({
                name: entryItem.name,
                initiatorType: entryItem.initiatorType,
                startTime: entryItem.startTime,
                duration: entryItem.duration,
              })),
            );
          }, RESOURCE_WINDOW_MS);
        });
      },
      { threshold: [0, 0.1] },
    );

    const mutationObserver = new MutationObserver(() => {
      if (footerRef.current) return;
      const footer = findFooter();
      if (footer) {
        handleFooterAvailable(footer, "mutation");
      }
    });

    const layoutShiftObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const shift = entry as PerformanceEntry & {
          value?: number;
          hadRecentInput?: boolean;
          sources?: Array<{ node?: Node | null }>;
        };
        const withinWindow =
          footerIntersectTime !== null &&
          Math.abs(shift.startTime - footerIntersectTime) <= SHIFT_WINDOW_MS;
        console.log("[footer-debug] layout-shift", {
          value: shift.value,
          startTime: shift.startTime,
          hadRecentInput: shift.hadRecentInput,
          nearFooter: withinWindow,
          sources: shift.sources?.map((source) =>
            source.node ? formatNode(source.node) : "unknown-source",
          ),
        });
      });
    });

    const longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        console.log("[footer-debug] longtask", {
          startTime: entry.startTime,
          duration: entry.duration,
          name: entry.name,
        });
      });
    });

    const scheduleInitialCheck = () => {
      requestAnimationFrame(() => {
        const footer = findFooter();
        console.log("[footer-debug] footer presence on raf", {
          exists: Boolean(footer),
          time: performance.now(),
        });
        if (footer) {
          handleFooterAvailable(footer, "initial");
        } else {
          mutationObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
          });
        }
      });
    };

    const logServiceWorkerState = async () => {
      if (!("serviceWorker" in navigator)) {
        console.log("[footer-debug] serviceWorker: not supported");
        return;
      }
      console.log("[footer-debug] serviceWorker controller", {
        controlled: Boolean(navigator.serviceWorker.controller),
        controller: navigator.serviceWorker.controller?.scriptURL,
      });
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(
          "[footer-debug] serviceWorker registrations",
          registrations.map((registration) => ({
            scope: registration.scope,
            active: registration.active?.state,
            waiting: registration.waiting?.state,
            installing: registration.installing?.state,
          })),
        );
      } catch (error) {
        console.log("[footer-debug] serviceWorker registrations failed", {
          error: String(error),
        });
      }
      if ("caches" in window) {
        try {
          const keys = await caches.keys();
          console.log("[footer-debug] cache keys", keys);
        } catch (error) {
          console.log("[footer-debug] cache keys failed", {
            error: String(error),
          });
        }
      }
    };

    try {
      layoutShiftObserver.observe({ type: "layout-shift", buffered: true });
    } catch (error) {
      console.log("[footer-debug] layout-shift observer unsupported", {
        error: String(error),
      });
    }

    try {
      longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch (error) {
      console.log("[footer-debug] longtask observer unsupported", {
        error: String(error),
      });
    }

    scheduleInitialCheck();
    void logServiceWorkerState();

    return () => {
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
      layoutShiftObserver.disconnect();
      longTaskObserver.disconnect();
      if (resourceTimer) clearTimeout(resourceTimer);
    };
  }, []);

  return null;
}
