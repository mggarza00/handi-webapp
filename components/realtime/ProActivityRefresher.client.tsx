"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ProActivityRefresher({
  proId,
}: {
  proId: string | null | undefined;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (!proId) return;
    const supabase = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    const channels = [
      supabase
        .channel(`pro-activity:calendar:${proId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pro_calendar_events",
            filter: `pro_id=eq.${proId}`,
          },
          scheduleRefresh,
        )
        .subscribe(),
      supabase
        .channel(`pro-activity:photos:${proId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "service_photos",
            filter: `professional_id=eq.${proId}`,
          },
          scheduleRefresh,
        )
        .subscribe(),
      supabase
        .channel(`pro-activity:ratings:${proId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ratings",
            filter: `to_user_id=eq.${proId}`,
          },
          scheduleRefresh,
        )
        .subscribe(),
      supabase
        .channel(`pro-activity:requests-prof:${proId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "requests",
            filter: `professional_id=eq.${proId}`,
          },
          scheduleRefresh,
        )
        .subscribe(),
      supabase
        .channel(`pro-activity:requests-accepted:${proId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "requests",
            filter: `accepted_professional_id=eq.${proId}`,
          },
          scheduleRefresh,
        )
        .subscribe(),
    ];

    return () => {
      if (timer) clearTimeout(timer);
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [proId, router]);

  return null;
}
