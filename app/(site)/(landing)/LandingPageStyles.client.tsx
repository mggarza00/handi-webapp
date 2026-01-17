"use client";

export default function LandingPageStyles() {
  return (
    <style jsx global>{`
      :root {
        --hero-header-height: 64px;
        --hero-tabbar-height: 72px;
        --hero-padding: 24px;
      }
      @media (width <= 768px) {
        .client-hero__visual {
          min-height: calc(
            100vh - var(--hero-header-height) - var(--hero-tabbar-height) -
              (2 * var(--hero-padding))
          );
          padding-bottom: calc(
            var(--hero-padding) + env(safe-area-inset-bottom, 0px)
          );
        }
        .guest-hero__visual {
          min-height: calc(
            100vh - var(--hero-header-height) - (1.5 * var(--hero-padding))
          );
          padding-bottom: calc(
            var(--hero-padding) + env(safe-area-inset-bottom, 0px)
          );
        }
      }
    `}</style>
  );
}
