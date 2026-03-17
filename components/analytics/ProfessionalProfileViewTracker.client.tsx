"use client";

import { useEffect } from "react";

import { trackProfessionalProfileViewed } from "@/lib/analytics/track";

type Props = {
  profileId: string;
};

export default function ProfessionalProfileViewTracker({ profileId }: Props) {
  useEffect(() => {
    if (!profileId) return;
    let sourcePage: string | undefined;
    try {
      if (typeof document !== "undefined" && document.referrer) {
        const ref = new URL(document.referrer);
        sourcePage = ref.pathname || undefined;
      }
    } catch {
      sourcePage = undefined;
    }
    trackProfessionalProfileViewed({
      profile_id: profileId,
      source_page: sourcePage,
      user_type: "unknown",
    });
  }, [profileId]);

  return null;
}
