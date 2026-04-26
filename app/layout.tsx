/* eslint-disable import/order */
/* eslint-disable @next/next/no-page-custom-font */
import "./globals.css";
import "@/app/(app)/leaflet.css";
import dynamicImport from "next/dynamic";
import type { Metadata } from "next";
import ClientToaster from "@/components/ClientToaster";
import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";
import AssistantPanelDirect from "@/components/assistant/AssistantPanel";
import MobileClientTabBar from "@/components/mobile-client-tabbar";
import InstallAppBannerDirect from "@/components/pwa/InstallAppBanner";
import RequestNotificationsToastDirect from "@/components/pwa/RequestNotificationsToast";
import RenderDiagnosticLogger from "@/components/render-diagnostics/RenderDiagnosticLogger.client";
import { concertOne, inter, nunito, rubik, varelaRound } from "@/lib/fonts";
import RegisterSW from "@/app/register-sw";
import DeferOnIdle from "@/components/DeferOnIdle.client";
import {
  isRenderDiagnosticModeEnabled,
  shouldBypassGlobalVisualDefer,
  shouldDisableFloatingWidgets,
} from "@/lib/renderDiagnostics";
import { getAppBaseUrl } from "@/lib/seo/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AssistantPanel = dynamicImport(
  () => import("@/components/assistant/AssistantPanel"),
  { ssr: false },
);
const InstallAppBanner = dynamicImport(
  () => import("@/components/pwa/InstallAppBanner"),
  { ssr: false },
);
const RequestNotificationsToast = dynamicImport(
  () => import("@/components/pwa/RequestNotificationsToast"),
  { ssr: false },
);
const PushAutoSubscribeOnGrant = dynamicImport(
  () => import("@/components/pwa/PushAutoSubscribeOnGrant.client"),
  { ssr: false },
);
const VercelLiveGuard = dynamicImport(
  () => import("@/components/VercelLiveGuard.client"),
  { ssr: false },
);
const AndroidWebViewControls = dynamicImport(
  () => import("@/components/capacitor/AndroidWebViewControls.client"),
  { ssr: false },
);
const CreateRequestWizardRoot = dynamicImport(
  () => import("@/components/requests/CreateRequestWizardRoot"),
  { ssr: false },
);

const appBaseUrl = getAppBaseUrl();
const defaultDescription =
  "Handi es la plataforma para solicitar servicios del hogar, conectar con profesionales compatibles, conversar por chat y cerrar acuerdos dentro de la app.";
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Handi",
  description:
    "Plataforma para solicitar servicios del hogar y coordinar acuerdos entre clientes y profesionales.",
  url: appBaseUrl,
  logo: `${appBaseUrl}/images/LOGO_HANDI_DB.png`,
  sameAs: ["https://www.instagram.com/handi_mx/"],
  areaServed: ["Monterrey", "San Pedro Garza Garcia", "Nuevo Leon"],
};
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Handi",
  description:
    "Solicita servicios para tu hogar, conecta con profesionales compatibles y acuerda dentro de Handi.",
  url: appBaseUrl,
  inLanguage: "es-MX",
  potentialAction: {
    "@type": "SearchAction",
    target: `${appBaseUrl}/search?query={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  applicationName: "Handi",
  title: {
    default: "Handi | Solicita servicios para tu hogar",
    template: "%s | Handi",
  },
  description: defaultDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Handi",
    description: defaultDescription,
    url: "/",
    siteName: "Handi",
    images: ["/images/LOGO_HANDI_DB.png"],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Handi",
    description: defaultDescription,
    images: ["/images/LOGO_HANDI_DB.png"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
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
  const diagnosticModeEnabled = isRenderDiagnosticModeEnabled();
  const bypassGlobalVisualDefer = shouldBypassGlobalVisualDefer();
  const disableFloatingWidgets = shouldDisableFloatingWidgets();
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${nunito.variable} ${varelaRound.variable} ${concertOne.variable} ${rubik.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        />
        <meta charSet="utf-8" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Apple splash screens */}
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-2048-2732.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-2732-2048.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-1668-2388.png"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-2388-1668.png"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-1536-2048.png"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-2048-1536.png"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-1284-2778.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-2778-1284.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-1170-2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-2532-1170.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-1179-2556.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-2556-1179.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-1290-2796.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/apple-splash-2796-1290.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <AnalyticsProvider />
        {diagnosticModeEnabled ? <RenderDiagnosticLogger /> : null}
        <DeferOnIdle timeoutMs={1500}>
          <AndroidWebViewControls />
          <VercelLiveGuard />
        </DeferOnIdle>
        {children}
        <ClientToaster />
        {disableAssistant ||
        disableFloatingWidgets ? null : bypassGlobalVisualDefer ? (
          <AssistantPanelDirect />
        ) : (
          <DeferOnIdle delayMs={900} timeoutMs={2200}>
            <AssistantPanel />
          </DeferOnIdle>
        )}
        {/* Mobile-only bottom tab bar for clients */}
        {disableFloatingWidgets ? null : <MobileClientTabBar />}
        <CreateRequestWizardRoot />
        {/* Ensure Service Worker is registered (place above install/notify banners) */}
        <RegisterSW />
        {/* Updater deshabilitado para no mostrar banner de nueva version */}
        {/* PWA install banner (Android native + iOS simulated) */}
        {disableFloatingWidgets ? (
          <PushAutoSubscribeOnGrant />
        ) : bypassGlobalVisualDefer ? (
          <>
            <InstallAppBannerDirect />
            {/* First-use notifications permission toast/help */}
            <RequestNotificationsToastDirect />
            {/* Auto-subscribe to Web Push when permission is granted */}
            <PushAutoSubscribeOnGrant />
          </>
        ) : (
          <DeferOnIdle delayMs={1200} timeoutMs={2400}>
            <InstallAppBanner />
            {/* First-use notifications permission toast/help */}
            <RequestNotificationsToast />
            {/* Auto-subscribe to Web Push when permission is granted */}
            <PushAutoSubscribeOnGrant />
          </DeferOnIdle>
        )}
      </body>
    </html>
  );
}
