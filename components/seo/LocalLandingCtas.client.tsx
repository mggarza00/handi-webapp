"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import CreateRequestButton from "@/components/requests/CreateRequestButton";
import { Button } from "@/components/ui/button";
import { trackLocalLandingCtaClicked } from "@/lib/analytics/track";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Props = {
  landingType: "service" | "city" | "service_city";
  serviceSlug?: string;
  citySlug?: string;
  authLabel?: string;
  unauthLabel?: string;
};

export default function LocalLandingCtas({
  landingType,
  serviceSlug,
  citySlug,
  authLabel = "Solicitar servicio",
  unauthLabel = "Registrarme y solicitar servicio",
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const qs = searchParams?.toString();
  const currentPath = `${pathname || "/"}${qs ? `?${qs}` : ""}`;
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(currentPath)}`;
  const sourcePage =
    typeof window !== "undefined" ? window.location.pathname : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {hasSession ? (
        <CreateRequestButton
          label={authLabel}
          size="default"
          variant="default"
          className="h-10 rounded-full bg-[#082877] px-5 text-sm font-semibold text-white hover:bg-[#0d3a9c]"
          onClick={() =>
            trackLocalLandingCtaClicked({
              landing_type: landingType,
              service_slug: serviceSlug,
              city_slug: citySlug,
              cta_type: "request_new",
              source_page: sourcePage,
            })
          }
        />
      ) : (
        <Button
          asChild
          size="default"
          className="h-10 rounded-full bg-[#082877] px-5 text-sm font-semibold text-white hover:bg-[#0d3a9c]"
        >
          <Link
            href={signInHref}
            onClick={() =>
              trackLocalLandingCtaClicked({
                landing_type: landingType,
                service_slug: serviceSlug,
                city_slug: citySlug,
                cta_type: "auth_before_request",
                source_page: sourcePage,
              })
            }
          >
            {unauthLabel}
          </Link>
        </Button>
      )}
      <Link
        href="/professionals"
        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:border-slate-400"
        onClick={() =>
          trackLocalLandingCtaClicked({
            landing_type: landingType,
            service_slug: serviceSlug,
            city_slug: citySlug,
            cta_type: "professionals_list",
            source_page: sourcePage,
          })
        }
      >
        Conocer profesionales compatibles
      </Link>
    </div>
  );
}
