/* eslint-disable import/order */
/* eslint-disable @next/next/no-page-custom-font */
import "./globals.css";
import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import ClientToaster from "@/components/ClientToaster";
const AssistantLauncher = nextDynamic(
  () => import("@/components/assistant/AssistantLauncher"),
  { ssr: false, loading: () => null },
);
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import MobileClientTabBar from "@/components/mobile-client-tabbar";
import { concertOne, nunito, varelaRound } from "@/lib/fonts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000",
  ),
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
    images: ["/handi-logo.gif"],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Handi",
    description:
      "La plataforma que te conecta con expertos de confianza para trabajos en casa: limpieza, reparaciones y mucho más.",
    images: ["/handi-logo.gif"],
  },
  icons: {
    // Primary favicon (animated GIF)
    icon: [
      { url: "/icons/Handi-favicon.gif", type: "image/gif" },
    ],
    // Keep ICO route for broader browser support
    shortcut: ["/favicon.ico", "/icons/Handi-favicon.gif"],
    // Apple touch icons prefer PNG; fallback to GIF if not provided
    apple: [
      { url: "/icons/Handi-favicon.gif" },
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
      className={`${nunito.variable} ${varelaRound.variable} ${concertOne.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300..900;1,300..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans">
        <SiteHeader />
        <main className="pt-16 pb-16 md:pb-0">{children}</main>
        <ClientToaster />
        {disableAssistant ? null : <AssistantLauncher />}
        <SiteFooter />
        {/* Mobile-only bottom tab bar for clients */}
        <MobileClientTabBar />
      </body>
    </html>
  );
}
/* eslint-disable import/order */
/* eslint-disable @next/next/no-page-custom-font */
