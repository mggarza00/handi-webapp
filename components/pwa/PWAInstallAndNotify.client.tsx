"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

import { isStandalonePWA } from "@/lib/pwa/install-detect";

const AndroidInstallPrompt = dynamic(() => import("./AndroidInstallPrompt.client"), { ssr: false });
const IOSInstallBanner = dynamic(() => import("./IOSInstallBanner.client"), { ssr: false });
const NotificationsOnboarding = dynamic(() => import("./NotificationsOnboarding.client"), { ssr: false });

export default function PWAInstallAndNotify() {
  const installed = useMemo(() => isStandalonePWA(), []);
  const vapid = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "";
  return (
    <>
      {/* Install prompts (only when not installed) */}
      {installed ? null : (
        <>
          <AndroidInstallPrompt />
          <IOSInstallBanner />
        </>
      )}
      {/* First-time notifications onboarding */}
      <NotificationsOnboarding publicKey={vapid} />
    </>
  );
}
