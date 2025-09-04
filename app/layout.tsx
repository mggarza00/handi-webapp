import "./globals.css";
import { Toaster } from "sonner";

import SiteHeader from "@/components/site-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: {
    default: "Handee",
    template: "%s | Handee",
  },
  description: "Encuentra profesionales confiables cerca de ti o publica tus servicios.",
  openGraph: {
    title: "Handee",
    description: "Encuentra profesionales confiables cerca de ti o publica tus servicios.",
    url: "/",
    siteName: "Handee",
    images: ["/handee-logo.png"],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Handee",
    description: "Encuentra profesionales confiables cerca de ti o publica tus servicios.",
    images: ["/handee-logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50">
        <SiteHeader />
        <main className="pt-16">{children}</main>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

