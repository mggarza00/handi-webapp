"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { isAndroid, isStandalonePWA } from "@/lib/pwa/install-detect";

type UserChoiceOutcome = "accepted" | "dismissed";

// Not present in TS libdom yet in a stable way
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: UserChoiceOutcome; platform: string }>;
}

const LS_KEY_DISMISSED = "handi:pwa:install:dismissed";

const logAndroidPromptError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[AndroidInstallPrompt]", error);
  }
};

export default function AndroidInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const installed = useMemo(() => isStandalonePWA(), []);
  const onAndroid = useMemo(() => isAndroid(), []);

  // Gate visibility based on localStorage flag
  const dismissed = useMemo(() => {
    if (typeof localStorage === "undefined") return false;
    try {
      return localStorage.getItem(LS_KEY_DISMISSED) === "1";
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (installed || dismissed || !onAndroid) return;
    const onEvent = (e: Event) => {
      const ev = e as BeforeInstallPromptEvent;
      ev.preventDefault?.();
      setDeferred(ev);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onEvent as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", onEvent as EventListener);
  }, [installed, dismissed, onAndroid]);

  const onClose = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(LS_KEY_DISMISSED, "1");
    } catch (error) {
      logAndroidPromptError(error);
    }
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice?.outcome === "accepted") {
        setVisible(false);
      } else {
        onClose();
      }
    } catch (error) {
      logAndroidPromptError(error);
      onClose();
    }
  }, [deferred, onClose]);

  if (!visible || installed || !onAndroid) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Instalar Handi</p>
          <p className="text-sm text-muted-foreground">Añádela a tu pantalla de inicio para una experiencia más rápida.</p>
        </div>
        <button
          aria-label="Cerrar"
          onClick={onClose}
          className="ml-2 text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Más tarde</Button>
        <Button onClick={onInstall}>Instalar</Button>
      </div>
    </div>
  );
}
