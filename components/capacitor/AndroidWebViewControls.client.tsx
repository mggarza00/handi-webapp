"use client";

import * as React from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function isExternalOrSpecialUrl(rawHref: string): boolean {
  try {
    const url = new URL(rawHref, window.location.origin);
    if (url.origin !== window.location.origin) return true;
    return !["http:", "https:"].includes(url.protocol);
  } catch {
    return true;
  }
}

export default function AndroidWebViewControls() {
  React.useEffect(() => {
    if (!isAndroidNative()) return;

    let destroyed = false;
    let removeBackButton: (() => void) | null = null;

    const onDocumentClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (event.defaultPrevented) return;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr) return;
      const resolved = new URL(hrefAttr, window.location.origin);
      const externalOrSpecial = isExternalOrSpecialUrl(resolved.href);

      // Internal links stay in-app, even if they were marked target="_blank".
      if (!externalOrSpecial) {
        if ((anchor.getAttribute("target") || "").toLowerCase() === "_blank") {
          event.preventDefault();
          window.location.assign(resolved.href);
        }
        return;
      }

      // External/special links open outside the app via native browser.
      event.preventDefault();
      try {
        await Browser.open({ url: resolved.href });
      } catch {
        // no-op: keep behavior conservative, avoid throwing in UI
      }
    };

    const originalWindowOpen = window.open.bind(window);
    window.open = (
      url?: string | URL,
      _target?: string,
      _features?: string,
    ) => {
      if (!url) return null;
      const resolved = new URL(String(url), window.location.origin);
      const externalOrSpecial = isExternalOrSpecialUrl(resolved.href);

      if (!externalOrSpecial) {
        window.location.assign(resolved.href);
        return null;
      }

      void Browser.open({ url: resolved.href }).catch(() => undefined);
      return null;
    };

    const setupBackButton = async () => {
      const listener = await CapacitorApp.addListener(
        "backButton",
        ({ canGoBack }) => {
          if (destroyed) return;
          if (canGoBack || window.history.length > 1) {
            window.history.back();
            return;
          }
          void CapacitorApp.minimizeApp().catch(() => undefined);
        },
      );
      removeBackButton = () => listener.remove();
    };

    void setupBackButton();
    document.addEventListener("click", onDocumentClick, true);

    return () => {
      destroyed = true;
      document.removeEventListener("click", onDocumentClick, true);
      window.open = originalWindowOpen;
      try {
        removeBackButton?.();
      } catch {
        // no-op
      }
    };
  }, []);

  return null;
}
