import type { Metadata } from "next";

import CampaignHeroLanding from "@/components/landing/CampaignHeroLanding";
import ProApplyLandingCta from "@/components/landing/ProApplyLandingCta.client";

export const metadata: Metadata = {
  title: "Landing profesionales | Handi",
  description:
    "Postulate como profesional en Handi. Landing de campana para adquisicion pro.",
  alternates: { canonical: "/landing/profesionales" },
  openGraph: {
    title: "Landing profesionales | Handi",
    description:
      "Postulate como profesional en Handi. Landing de campana para adquisicion pro.",
    url: "/landing/profesionales",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Landing profesionales | Handi",
    description:
      "Postulate como profesional en Handi. Landing de campana para adquisicion pro.",
  },
};

export default function CampaignProsLandingPage() {
  return (
    <CampaignHeroLanding
      imageSrc="/images/Landing_pro1.jpg"
      imageAlt="Landing de campana para profesionales Handi"
      imageClassName="object-[56%_center] md:object-center"
      ctaWrapperClassName="items-end justify-center md:justify-start md:items-end"
      cta={<ProApplyLandingCta />}
    />
  );
}
