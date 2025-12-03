"use client";

import { useEffect, useState } from "react";

const logSwUpdateError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[ServiceWorkerUpdater]", error);
  }
};

function useServiceWorkerUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let mounted = true;
    let reg: ServiceWorkerRegistration | null = null;

    const check = async () => {
      try {
        if (!reg) reg = (await navigator.serviceWorker.getRegistration()) || null;
        if (!mounted || !reg) return;
        if (reg.waiting) setWaiting(reg.waiting);
        await reg.update().catch((error) => {
          logSwUpdateError(error);
        });
        if (reg.waiting) setWaiting(reg.waiting);
      } catch (error) {
        logSwUpdateError(error);
      }
    };

    // wire updatefound -> installed -> setWaiting
    (async () => {
      try {
        reg = (await navigator.serviceWorker.getRegistration()) || null;
        if (!mounted || !reg) return;
        if (reg.waiting) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg?.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && reg && reg.waiting) {
              setWaiting(reg.waiting);
            }
          });
        });
        // initial and periodic checks
        await check();
      } catch (error) {
        logSwUpdateError(error);
      }
    })();

    // Chequeo periódico (cada 30 min)
    const id = window.setInterval(async () => {
      try {
        await check();
      } catch (error) {
        logSwUpdateError(error);
      }
    }, 30 * 60 * 1000);

    // Listener único en cada clic

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  const reload = () => {
    if (!waiting) return;
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      const onCtrl = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onCtrl);
        try {
          window.location.reload();
        } catch (error) {
          logSwUpdateError(error);
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', onCtrl);
    } catch (error) {
      logSwUpdateError(error);
    }
  };

  return { hasUpdate: !!waiting, reload } as const;
}

export default function ServiceWorkerUpdater() {
  const { hasUpdate, reload } = useServiceWorkerUpdate();
  if (!hasUpdate) return null;
  return (
    <div className="fixed inset-x-0 bottom-24 mx-auto w-95% max-w-md rounded-2xl shadow-lg border bg-white p-4 z-60">
      <div className="text-sm font-semibold">Nueva versión disponible</div>
      <p className="text-xs mt-1">Actualiza para obtener las últimas mejoras y correcciones.</p>
      <div className="mt-3 flex gap-2 justify-end">
        <button
          className="px-3 py-1.5 text-sm rounded-xl border"
          onClick={() => {
            try {
              window.location.reload();
            } catch (error) {
              logSwUpdateError(error);
            }
          }}
        >
          Luego
        </button>
        <button className="px-3 py-1.5 text-sm rounded-xl bg-black text-white" onClick={reload}>
          Actualizar ahora
        </button>
      </div>
    </div>
  );
}
