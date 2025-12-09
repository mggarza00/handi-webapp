import { useEffect, useState } from "react";

import isSafariOniOS, { isStandalonePWA, isAndroid } from "./install-detect";

type UserChoiceOutcome = "accepted" | "dismissed";

export type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: UserChoiceOutcome; platform?: string }>;
};

const ANDROID_DISMISS_KEY = "handi:pwa:install:dismissed";
// Align with requested key; keep legacy key support when reading
const IOS_DISMISS_KEY = "handi_iOS_install_dismissed";
const IOS_DISMISS_KEY_LEGACY = "handi:pwa:ios:banner:dismissed";

export function useInstallPrompts() {
  const [installed, setInstalled] = useState<boolean>(false);
  const [androidEvent, setAndroidEvent] = useState<BIPEvent | null>(null);
  const [_showAndroidPrompt, setShowAndroidPrompt] = useState<boolean>(false);
  const [showIOSBanner, setShowIOSBanner] = useState<boolean>(false);
  const isiOSSafari = isSafariOniOS();
  const isAndroidDevice = isAndroid();
  
  // Determine initial installed state (client only)
  useEffect(() => {
    setInstalled(isStandalonePWA());
    const onAppInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => window.removeEventListener("appinstalled", onAppInstalled);
  }, []);

  // Android: capture beforeinstallprompt and decide visibility
  useEffect(() => {
    if (installed || !isAndroidDevice) return;
    const dismissed = (() => {
      try { return localStorage.getItem(ANDROID_DISMISS_KEY) === "1"; } catch { return false; }
    })();
    // ANDROID
    const handler = (e: Event) => {
      const ev = e as BIPEvent;
      ev.preventDefault?.();
      setAndroidEvent(ev);
      if (!dismissed) setShowAndroidPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, [installed, isAndroidDevice]);

  // iOS banner: mostrar en Safari iOS si no está instalada.
  useEffect(() => {
    if (installed || !isiOSSafari) return;
    try {
      const dismissed = (localStorage.getItem(IOS_DISMISS_KEY) === "1") || (localStorage.getItem(IOS_DISMISS_KEY_LEGACY) === "1");
      if (!dismissed) setShowIOSBanner(true);
    } catch {
      setShowIOSBanner(true);
    }
  }, [installed, isiOSSafari]);

  // Alias to match requested API name
  async function triggerAndroidInstall(): Promise<void> {
    const ev = androidEvent;
    if (!ev) return;
    await ev.prompt();
    setAndroidEvent(null);
  }

  function dismissIOSBanner() {
    try { localStorage.setItem(IOS_DISMISS_KEY, "1"); } catch { /* ignore */ }
    setShowIOSBanner(false);
  }

  return { androidEvent, triggerAndroidInstall, showIOSBanner, dismissIOSBanner } as const;
}

export default useInstallPrompts;

