import type { Metadata } from "next";

import CampaignHeroLanding from "@/components/landing/CampaignHeroLanding";
import ClientRequestLandingCta from "@/components/landing/ClientRequestLandingCta.client";

export const metadata: Metadata = {
  title: "Landing clientes | Handi",
  description:
    "Solicita servicios para tu hogar con Handi. Landing de campana para clientes.",
  alternates: { canonical: "/landing/clientes" },
  openGraph: {
    title: "Landing clientes | Handi",
    description:
      "Solicita servicios para tu hogar con Handi. Landing de campana para clientes.",
    url: "/landing/clientes",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Landing clientes | Handi",
    description:
      "Solicita servicios para tu hogar con Handi. Landing de campana para clientes.",
  },
};

export default function CampaignClientsLandingPage() {
  return (
    <CampaignHeroLanding
      imageSrc="/images/Landing_cliente1.jpg"
      imageAlt="Landing de campana para clientes Handi"
      imageClassName="object-[58%_center] md:object-center"
      ctaWrapperClassName="items-end justify-center md:justify-start md:items-end"
      cta={<ClientRequestLandingCta />}
    />
  );
}
