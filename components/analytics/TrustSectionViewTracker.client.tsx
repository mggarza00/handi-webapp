"use client";

import { useEffect, useRef } from "react";

import { trackTrustSectionViewed } from "@/lib/analytics/track";

type Props = {
  pageType: string;
  sectionId?: string;
  serviceSlug?: string;
  citySlug?: string;
};

export default function TrustSectionViewTracker({
  pageType,
  sectionId,
  serviceSlug,
  citySlug,
}: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || trackedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35,
        );
        if (!visible || trackedRef.current) return;
        trackedRef.current = true;
        trackTrustSectionViewed({
          page_type: pageType,
          section_id: sectionId,
          service_slug: serviceSlug,
          city_slug: citySlug,
          source_page:
            typeof window !== "undefined"
              ? window.location.pathname
              : undefined,
        });
        observer.disconnect();
      },
      { threshold: [0.35, 0.6] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [citySlug, pageType, sectionId, serviceSlug]);

  return <span ref={ref} className="sr-only" aria-hidden="true" />;
}
