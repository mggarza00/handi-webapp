"use client";
import * as React from "react";

import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function HiddenIfClientHasSession({ children }: { children: React.ReactNode }) {
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createSupabaseBrowser();
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setHasSession(!!data?.session);
      } catch {
        if (active) setHasSession(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  if (hasSession === null) return null;
  if (hasSession) return null;
  return <>{children}</>;
}
