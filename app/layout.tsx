import "./globals.css";
import SiteHeader from "@/components/site-header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50">
        <SiteHeader />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
