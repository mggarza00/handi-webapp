"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function ProfessionalLandingCta() {
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowser();

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setHasSession(Boolean(data?.session));
      } catch {
        if (active) setHasSession(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        setHasSession(Boolean(session));
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const proAuthHref = "/auth/sign-in?next=%2Fpro-apply";

  return (
    <div className="flex flex-wrap gap-3">
      {hasSession ? (
        <Button
          asChild
          className="inline-flex items-center justify-center rounded-full bg-[#082877] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d3a9c]"
        >
          <Link href="/requests/explore">Visitar trabajos disponibles</Link>
        </Button>
      ) : (
        <Button
          asChild
          className="inline-flex items-center justify-center rounded-full bg-[#082877] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d3a9c]"
        >
          <Link href={proAuthHref}>Postularme como profesional</Link>
        </Button>
      )}
    </div>
  );
}
