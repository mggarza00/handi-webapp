"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { isIOS, isStandalonePWA } from "@/lib/pwa/install-detect";

const LS_KEY_IOS_BANNER_DISMISSED = "handi:pwa:ios:banner:dismissed";

export default function IOSInstallBanner() {
  const onIOS = useMemo(() => isIOS(), []);
  const installed = useMemo(() => isStandalonePWA(), []);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!onIOS || installed) return;
    try {
      const dis = localStorage.getItem(LS_KEY_IOS_BANNER_DISMISSED) === "1";
      if (!dis) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [onIOS, installed]);

  if (!visible || !onIOS || installed) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Agregar Handi a tu pantalla de inicio</p>
          <p className="text-sm text-muted-foreground">
            En Safari, toca el botón de compartir y luego &quot;Agregar a pantalla de inicio&quot;.
          </p>
        </div>
        <button
          aria-label="Cerrar"
          onClick={() => {
            setVisible(false);
            try {
              localStorage.setItem(LS_KEY_IOS_BANNER_DISMISSED, "1");
            } catch {
              // ignore
            }
          }}
          className="ml-2 text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="ghost"
          onClick={() => {
            setVisible(false);
            try {
              localStorage.setItem(LS_KEY_IOS_BANNER_DISMISSED, "1");
            } catch {
              // ignore
            }
          }}
        >
          Entendido
        </Button>
      </div>
    </div>
  );
}
