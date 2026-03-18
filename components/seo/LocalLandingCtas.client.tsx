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
};

export default function LocalLandingCtas({
  landingType,
  serviceSlug,
  citySlug,
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
    <div className="flex flex-wrap items-center gap-2">
      {hasSession ? (
        <CreateRequestButton
          label="Solicitar servicio"
          size="sm"
          variant="outline"
          className="h-8 rounded-full px-3 text-xs"
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
          size="sm"
          variant="outline"
          className="h-8 rounded-full px-3 text-xs"
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
            Regístrate y solicita un servicio
          </Link>
        </Button>
      )}
      <Link
        href="/professionals"
        className="text-xs font-semibold text-[#082877] hover:underline"
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
        Ver profesionales
      </Link>
    </div>
  );
}
