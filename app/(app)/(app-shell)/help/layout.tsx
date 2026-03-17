import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description:
    "Guia oficial de Handi para clientes y profesionales: seguridad en chat, acuerdos, pagos y soporte.",
  alternates: { canonical: "/help" },
  openGraph: {
    title: "Centro de ayuda | Handi",
    description:
      "Guia oficial de Handi para clientes y profesionales: seguridad en chat, acuerdos, pagos y soporte.",
    url: "/help",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Centro de ayuda | Handi",
    description:
      "Guia oficial de Handi para clientes y profesionales: seguridad en chat, acuerdos, pagos y soporte.",
  },
};

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
