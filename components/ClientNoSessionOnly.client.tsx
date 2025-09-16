"use client";
import * as React from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function ClientNoSessionOnly({ children }: { children: React.ReactNode }) {
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClientComponentClient();
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
  const hidden = hasSession === true;
  return <span style={hidden ? { display: "none" } : undefined}>{children}</span>;
}

