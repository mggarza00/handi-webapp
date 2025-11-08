/* eslint-disable import/order */
/* eslint-disable @next/next/no-page-custom-font */
import "./globals.css";
import type { Metadata } from "next";
import ClientToaster from "@/components/ClientToaster";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import SiteHeader from "@/components/site-header";
import ConditionalSiteHeader from "@/components/ConditionalSiteHeader.client";
import ConditionalFooter from "@/components/ConditionalFooter.client";
import MobileClientTabBar from "@/components/mobile-client-tabbar";
import { concertOne, nunito, varelaRound } from "@/lib/fonts";
import LeafletCSS from "@/components/LeafletCSS.client";
import OneTapMount from "@/components/OneTapMount";
import ConditionalMainWrapper from "@/components/ConditionalMainWrapper.client";
import InstallAppBanner from "@/components/pwa/InstallAppBanner";
import RequestNotificationsToast from "@/components/pwa/RequestNotificationsToast";
import PushAutoSubscribeOnGrant from "@/components/pwa/PushAutoSubscribeOnGrant.client";
import RegisterSW from "@/app/register-sw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000",
  ),
  applicationName: "Handi",
  title: {
    default: "Handi",
    template: "%s | Handi",
  },
  description:
    "La plataforma que te conecta con expertos de confianza para trabajos en casa: limpieza, reparaciones y mucho más.",
  openGraph: {
    title: "Handi",
    description:
      "La plataforma que te conecta con expertos de confianza para trabajos en casa: limpieza, reparaciones y mucho más.",
    url: "/",
    siteName: "Handi",
    images: ["/images/Logo-Handi-v2.gif"],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Handi",
    description:
      "La plataforma que te conecta con expertos de confianza para trabajos en casa: limpieza, reparaciones y mucho más.",
    images: ["/images/Logo-Handi-v2.gif"],
  },
  manifest: "/manifest.json",
  icons: {
    // Mantener rutas originales de favicon por compatibilidad
    icon: [
      { url: "/icons/favicon-handi.gif", type: "image/gif" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: ["/favicon.ico", "/icons/favicon-handi.gif"],
    apple: [
      { url: "/icons/favicon-handi.gif" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const disableAssistant =
    (process.env.NEXT_PUBLIC_DISABLE_ASSISTANT || "").trim() === "1";
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${nunito.variable} ${varelaRound.variable} ${concertOne.variable}`}
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/favicon-handi.gif" />
        <link rel="icon" type="image/gif" href="/icons/favicon-handi.gif" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300..900;1,300..900&display=swap" rel="stylesheet" />
        {/* Apple splash screens */}
        <link rel="apple-touch-startup-image" href="/apple-splash-2048-2732.jpg" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-2732-2048.jpg" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1668-2388.jpg" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-2388-1668.jpg" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1536-2048.jpg" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-2048-1536.jpg" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1284-2778.jpg" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-2778-1284.jpg" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1170-2532.jpg" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-2532-1170.jpg" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1179-2556.jpg" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-2556-1179.jpg" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1290-2796.jpg" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-2796-1290.jpg" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {/* Google One Tap (solo cliente; no renderiza UI propia) */}
        <OneTapMount />
        <ConditionalSiteHeader>
          <SiteHeader />
        </ConditionalSiteHeader>
        <ConditionalMainWrapper>{children}</ConditionalMainWrapper>
        <ClientToaster />
        {disableAssistant ? null : <AssistantPanel />}
        <ConditionalFooter />
        {/* Mobile-only bottom tab bar for clients */}
        <MobileClientTabBar />
        {/* Load Leaflet styles once on client */}
        <LeafletCSS />
        {/* Ensure Service Worker is registered (place above install/notify banners) */}
        <RegisterSW />
        {/* Updater deshabilitado para no mostrar banner de nueva versión */}
        {/* PWA install banner (Android native + iOS simulated) */}
        <InstallAppBanner />
        {/* First-use notifications permission toast/help */}
        <RequestNotificationsToast />
        {/* Auto-subscribe to Web Push when permission is granted */}
        <PushAutoSubscribeOnGrant />
      </body>
    </html>
  );
}
/* eslint-disable import/order */
/* eslint-disable @next/next/no-page-custom-font */
