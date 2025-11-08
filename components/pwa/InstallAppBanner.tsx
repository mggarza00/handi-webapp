"use client";

import { useEffect, useState } from "react";
import useInstallPrompts from "@/lib/pwa/useInstallPrompts";
import isSafariOniOS from "@/lib/pwa/install-detect";

export default function InstallAppBanner() {
  const { androidEvent, triggerAndroidInstall, showIOSBanner, dismissIOSBanner } = useInstallPrompts();
  const [isIOS, setIsIOS] = useState(false);
  const [androidDismissed, setAndroidDismissed] = useState(false);

  useEffect(() => setIsIOS(isSafariOniOS()), []);

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-x-0 top-[72px] md:top-[84px] mx-auto w-[95%] max-w-md rounded-2xl shadow-lg border border-white/15 bg-neutral-900/80 backdrop-blur-md p-4 z-[60] text-white">
      {children}
    </div>
  );

  const showAndroid = !!androidEvent && !androidDismissed;
  const showIOS = isIOS && showIOSBanner;

  if (!showAndroid && !showIOS) return null;

  async function onInstallAndroid() {
    try {
      await triggerAndroidInstall();
    } catch {
      // ignore
    }
    setAndroidDismissed(true);
  }

  function onDismissAndroid() {
    try {
      localStorage.setItem("handi:pwa:install:dismissed", "1");
    } catch {
      // ignore
    }
    setAndroidDismissed(true);
  }

  return (
    <>
      {showAndroid && (
        <Card>
          <div className="text-sm font-semibold">Instala Handi</div>
          <p className="text-xs mt-1">Descarga la app para tener una experiencia más completa.</p>
          <div className="mt-3 flex gap-2 justify-end">
            <button
              className="px-3 py-1.5 text-sm rounded-xl bg-black text-white"
              onClick={onDismissAndroid}
            >
              Más tarde
            </button>
            <button
              className="px-3 py-1.5 text-sm rounded-xl bg-white text-black"
              onClick={onInstallAndroid}
            >
              Instalar
            </button>
          </div>
        </Card>
      )}

      {showIOS && (
        <Card>
          <div className="text-sm font-semibold">Instala Handi</div>
          <p className="text-xs mt-1">
            Pulsa <span className="font-semibold">Compartir</span> y luego <span className="font-semibold">Agregar a pantalla de inicio</span>.
          </p>
          <ol className="text-xs mt-2 list-decimal pl-4 space-y-1">
            <li>Toca el botón de Compartir (cuadro con flecha) en Safari.</li>
            <li>Elige Agregar a pantalla de inicio.</li>
            <li>Confirma con Agregar.</li>
          </ol>
          <div className="mt-3 flex gap-2 justify-end">
            <button className="px-3 py-1.5 text-sm rounded-xl bg-black text-white" onClick={dismissIOSBanner}>
              Más tarde
            </button>
            <button className="px-3 py-1.5 text-sm rounded-xl bg-white text-black" onClick={dismissIOSBanner}>
              Listo
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
