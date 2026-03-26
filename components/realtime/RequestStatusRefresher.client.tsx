"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase-browser";

export default function RequestStatusRefresher({
  requestId,
}: {
  requestId: string | null | undefined;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (!requestId) return;
    const supabase = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase
      .channel(`request-status:${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requests",
          filter: `id=eq.${requestId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pro_calendar_events",
          filter: `request_id=eq.${requestId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ratings",
          filter: `request_id=eq.${requestId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [requestId, router]);

  return null;
}
