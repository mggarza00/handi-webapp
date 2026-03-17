"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { captureAttributionFromCurrentUrl } from "@/lib/analytics/attribution";

export default function AttributionCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  useEffect(() => {
    captureAttributionFromCurrentUrl();
  }, [pathname, searchParamsString]);

  return null;
}
