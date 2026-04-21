import type { ReactNode } from "react";
import Script from "next/script";

const googleAdsTagId = "AW-18027876784";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsTagId}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-tag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          window.gtag('js', new Date());
          window.gtag('config', '${googleAdsTagId}');
        `}
      </Script>
      {children}
    </>
  );
}
