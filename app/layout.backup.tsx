
// app/layout.tsx (server component)
export const metadata = {
  title: "Handee — Encuentra profesionales confiables cerca de ti",
  description:
    "Publica lo que necesitas o ofrece tus servicios. Perfiles verificados, reseñas reales y respuesta rápida.",
  openGraph: {
    title: "Handee — Encuentra, conecta, resuelve.",
    description:
      "Conecta con profesionales validados para arreglar, construir o mejorar lo que necesites.",
    url: "https://handee.mx",
    siteName: "Handee",
    images: [{ url: "/og-handee.jpg", width: 1200, height: 630, alt: "Handee" }],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Handee — Encuentra, conecta, resuelve.",
    description: "Perfiles verificados, reseñas reales y respuesta rápida.",
    images: ["/og-handee.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
