"use client";

export default function LandingPageStyles() {
  return (
    <style jsx global>{`
      :root {
        --hero-header-height: 64px;
        --hero-padding: 24px;
      }
      @media (width <= 768px) {
        .client-hero__visual,
        .guest-hero__visual {
          padding-bottom: calc(
            var(--hero-padding) + env(safe-area-inset-bottom, 0px)
          );
        }
      }
    `}</style>
  );
}
