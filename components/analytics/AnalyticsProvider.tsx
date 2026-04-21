"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

import { captureAttributionFromCurrentUrl } from "@/lib/analytics/attribution";
import { setClarityTags } from "@/lib/analytics/clarity";
import { configureGa4 } from "@/lib/analytics/ga4";
import { trackAnalyticsEvent, trackPageView } from "@/lib/analytics/tracking";

const ga4MeasurementId =
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || "";
const clarityProjectId =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() || "";

function getLandingPayload(pathname: string) {
  if (pathname === "/") {
    return {
      landing_type: "home",
      source_page: pathname,
    };
  }

  if (pathname === "/landing/clientes") {
    return {
      landing_type: "campaign_clients",
      source_page: pathname,
    };
  }

  if (pathname === "/landing/profesionales") {
    return {
      landing_type: "campaign_professionals",
      source_page: pathname,
    };
  }

  return null;
}

export default function AnalyticsProvider() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  useEffect(() => {
    configureGa4();
  }, []);

  useEffect(() => {
    const state = captureAttributionFromCurrentUrl();
    const pagePath = searchParamsString
      ? `${pathname}?${searchParamsString}`
      : pathname;

    trackPageView({
      pagePath,
      pageTitle: typeof document !== "undefined" ? document.title : "Handi",
      pageLocation:
        typeof window !== "undefined" ? window.location.href : undefined,
    });

    setClarityTags({
      handi_first_touch_campaign: state.first_touch?.utm_campaign,
      handi_last_touch_campaign: state.last_touch?.utm_campaign,
      handi_page_path: pathname,
    });

    const landingPayload = getLandingPayload(pathname);
    if (landingPayload) {
      trackAnalyticsEvent("landing_viewed", landingPayload);
    }
  }, [pathname, searchParamsString]);

  return (
    <>
      {ga4MeasurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
            `}
          </Script>
        </>
      ) : null}
      {clarityProjectId ? (
        <Script id="clarity-init" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityProjectId}");
          `}
        </Script>
      ) : null}
    </>
  );
}
